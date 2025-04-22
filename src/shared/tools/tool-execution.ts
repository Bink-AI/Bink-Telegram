import { TelegramBot } from '@/telegram-bot/telegram-bot';
import { formatSmartNumber } from '@/telegram-bot/utils/format-text';
import { EMessageType } from '../constants/enums';
import { getScanUrl, getNetwork, getProvider } from '../helper';

/**
 * Enum representing the different states of a tool execution
 */
export enum ToolExecutionState {
  STARTED = 'started',
  IN_PROCESS = 'in_process',
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Enum representing the different tool names
 */
export enum ToolName {
  CREATE_PLAN = 'create_plan',
  UPDATE_PLAN = 'update_plan',
  SWAP = 'swap',
  BRIDGE = 'bridge',
  STAKE = 'staking',
  TRANSFER = 'transfer_tokens',
}

/**
 * Enum representing the different types of staking operations
 */
export enum StakingOperationType {
  STAKE = 'stake',
  SUPPLY = 'supply',
  UNSTAKE = 'unstake',
  WITHDRAW = 'withdraw',
  TRANSFER = 'transfer_tokens',
}

/**
 * Interface for tool execution data
 */
export interface ToolExecutionData {
  state: ToolExecutionState;
  timestamp: number;
  message: string;
  toolName?: ToolName;
  input?: {
    plans?: {
      title?: string;
      tasks?: string[];
    }[];
  };
  data?: {
    progress?: number;
    [key: string]: any;
  };
  error?: Error | string;
}

/**
 * Interface for tool execution callback
 */
export interface IToolExecutionCallback {
  onToolExecution(data: ToolExecutionData): void;
}

/**
 * Example implementation of the IToolExecutionCallback interface
 * that logs tool execution data with emojis and formatting
 */
export class ExampleToolExecutionCallback implements IToolExecutionCallback {
  bot: TelegramBot;
  chatId: string;
  messageId: number;
  messagePlanListId: number;
  messageData: (type: string, message: string) => void;
  handleTransaction: (telegramId: string, transactionData: any) => void;
  constructor(
    chatId: string,
    bot: TelegramBot,
    messageId: number,
    messagePlanListId: number,
    messageData: (type: string, message: string) => void,
    handleTransaction: (telegramId: string, transactionData: any) => void,
  ) {
    this.chatId = chatId;
    this.bot = bot;
    this.messageId = messageId;
    this.messagePlanListId = messagePlanListId;
    this.messageData = messageData;
    this.handleTransaction = handleTransaction;
  }

  setMessageId(messageId: number) {
    this.messageId = messageId;
  }

  setMessagePlanListId(messagePlanListId: number) {
    this.messagePlanListId = messagePlanListId;
  }

  setMessageData(messageData: (type: string, message: string) => void) {
    this.messageData = messageData;
  }

  setHandleTransaction(handleTransaction: (telegramId: string, transactionData: any) => void) {
    this.handleTransaction = handleTransaction;
  }

  onToolExecution(data: ToolExecutionData): void {
    const stateEmoji = {
      [ToolExecutionState.STARTED]: '🔸',
      [ToolExecutionState.IN_PROCESS]: '⏳',
      [ToolExecutionState.COMPLETED]: '✅',
      [ToolExecutionState.FAILED]: '❌',
      [ToolExecutionState.PENDING]: '⏳',
    };

    const emoji = stateEmoji[data.state] || '🔄';

    console.log(`${emoji} [${new Date(data.timestamp).toISOString()}] ${data.message}`);

    if (data.state === ToolExecutionState.STARTED && data.toolName === ToolName.CREATE_PLAN) {
      let message = ``;

      // Format plans with title and tasks with radio buttons
      data.input.plans.forEach((plan: any, planIndex: number) => {
        if (plan.title) {
          message += `<b>Plan ${planIndex + 1}: ${plan.title}</b>\n\n`;

          if (plan.tasks && Array.isArray(plan.tasks)) {
            plan.tasks.forEach((task: string, taskIndex: number) => {
              message += `${emoji} ${task}\n`;
            });
          }

          message += '\n';
        }
      });
      try {
        // Delete the current message first
        this.bot
          .deleteMessage(this.chatId, this.messageId.toString())
          .then(() => {
            // After successful deletion, send the plan message
            return this.bot.sendMessage(this.chatId, message, {
              parse_mode: 'HTML',
            });
          })
          .then(messagePlanListId => {
            this.setMessagePlanListId(messagePlanListId.message_id);

            // After sending plan message, send the executing message
            return this.bot.sendMessage(this.chatId, 'Executing plans...', {
              parse_mode: 'HTML',
            });
          })
          .then(messageId => {
            this.setMessageId(messageId.message_id);
            // TODO: Delete the message plan list
            //  this.bot.deleteMessage(this.chatId, this.messageId.toString());
          })
          .catch(error => {
            console.error(
              '🚀 ~ ExampleToolExecutionCallback ~ onToolExecution ~ error',
              error.message,
            );
          });
      } catch (error) {
        console.log('🚀 ~ ExampleToolExecutionCallback ~ onToolExecution ~ error', error.message);
        this.bot.sendMessage(this.chatId, 'Please try again', {
          parse_mode: 'HTML',
        });
      }
    }

    if (data.state === ToolExecutionState.IN_PROCESS && data.data) {
      if (data.data.progress < 100) {
        this.bot.editMessageText(`${emoji} ${data.message}`, {
          chat_id: this.chatId,
          message_id: this.messageId,
        });
      }

      console.log(`Progress: ${data.data.progress || 0}%`);
    }

    if (data.state === ToolExecutionState.COMPLETED && data.data) {
      if (
        data.data?.status === 'success' &&
        (data.toolName === ToolName.SWAP ||
          data.toolName === ToolName.BRIDGE ||
          data.toolName === ToolName.STAKE ||
          data.toolName === ToolName.TRANSFER)
      ) {
        let message;

        if (data.toolName === ToolName.SWAP) {
          const scanUrl = getScanUrl(data.data.network, data.data.transactionHash);
          message = `🎉 <b>Congratulations, your transaction has been successful.</b>
- <b>Swapped:</b> ${formatSmartNumber(data.data.fromAmount)} ${data.data.fromToken?.symbol || ''} 
- <b>Received:</b> ${formatSmartNumber(data.data.toAmount)} ${data.data.toToken?.symbol || ''}
- <b>Network:</b> ${getNetwork(data.data.network)}
- <b>Protocol:</b> ${getProvider(data.data.provider)}
- <b>Transaction Hash:</b> <a href="${scanUrl}">View on ${getNetwork(data.data.network)} Explorer</a>
`;
        } else if (data.toolName === ToolName.BRIDGE) {
          const scanUrl = getScanUrl(data.data.fromNetwork, data.data.transactionHash);
          message = `🎉 <b>Congratulations, your transaction has been successful.</b>
- <b>Swapped:</b> ${formatSmartNumber(data.data.fromAmount)} ${data.data.fromToken?.symbol || ''} (${getNetwork(data.data.fromNetwork)})
- <b>Received:</b> ${formatSmartNumber(data.data.toAmount)} ${data.data.toToken?.symbol || ''} (${getNetwork(data.data.toNetwork)})
- <b>Protocol:</b> ${getProvider(data.data.provider)}
- <b>Transaction Hash:</b> <a href="${scanUrl}">View on ${getNetwork(data.data.fromNetwork)} Explorer</a>
`;
        } else if (data.toolName === ToolName.STAKE) {
          const scanUrl = getScanUrl(data.data.network, data.data.transactionHash);

          if (
            data.data.type === StakingOperationType.STAKE ||
            data.data.type === StakingOperationType.SUPPLY
          ) {
            message = `🎉 <b>Congratulations, your transaction has been successful.</b>
- <b>Staked:</b> ${formatSmartNumber(data.data.amountA || 0)} ${data.data.tokenA?.symbol || ''}
- <b>Network:</b> ${getNetwork(data.data.network)}
- <b>Protocol:</b> ${getProvider(data.data.provider)}
- <b>Transaction Hash:</b> <a href="${scanUrl}">View on ${getNetwork(data.data.network)} Explorer</a>
          `;
          } else if (
            data.data.type === StakingOperationType.UNSTAKE ||
            data.data.type === StakingOperationType.WITHDRAW
          ) {
            message = `🎉 <b>Congratulations, your transaction has been successful.</b>
- <b>Unstaked:</b> ${formatSmartNumber(data.data.amountA || 0)} ${data.data.tokenA?.symbol || ''}
- <b>Network:</b> ${getNetwork(data.data.network)}
- <b>Protocol:</b> ${getProvider(data.data.provider)}
- <b>Transaction Hash:</b> <a href="${scanUrl}">View on ${getNetwork(data.data.network)} Explorer</a>
          `;
          console.log('🚀 ~ ExampleToolExecutionCallback ~ onToolExecution ~ data', data);
            const dataTransaction = {
              type: data.data.type,
              amount: data.data.amountA || 0,
              tokenSymbol: data.data.tokenA?.symbol || '',
              network: data.data.network,
              provider: data.data.provider,
              transactionHash: data.data.transactionHash,
              timestamp: data.timestamp,
              address: data.data.address || '',
            };
            // Pass the transaction data to the callback for database storage
            this.handleTransaction(this.chatId, dataTransaction);
          }
        } else if (data.toolName === ToolName.TRANSFER) {
          const scanUrl = getScanUrl(data.data.network, data.data.transactionHash);
          message = `🎉 <b>Congratulations, your transaction has been successful.</b>
- <b>To:</b> ${data.data.toAddress}
- <b>Amount:</b> ${formatSmartNumber(data.data.amount || 0)} ${data.data.token?.symbol || ''}
- <b>Network:</b> ${getNetwork(data.data.network)}
- <b>Transaction Hash:</b> <a href="${scanUrl}">View on ${getNetwork(data.data.network)} Explorer</a>
        `;
        }
        this.messageData(EMessageType.TOOL_EXECUTION, message);
      }

      if (data.toolName === ToolName.UPDATE_PLAN) {
        let message = ``;
        // Format plans with title and tasks with radio buttons
        data.data.forEach((task: any, taskIndex: number) => {
          if (task.title) {
            message += `<b>Task ${taskIndex + 1}: ${task.title}</b>\n\n`;

            if (task.tasks && Array.isArray(task.tasks)) {
              task.tasks.forEach((task: any) => {
                const taskEmoji = stateEmoji[task.status] || '🔄';
                message += `${taskEmoji} ${task.title}\n`;
              });
            }

            message += '\n';
            if (
              task.status === ToolExecutionState.COMPLETED ||
              task.status === ToolExecutionState.FAILED
            ) {
              try {
                // this.bot.deleteMessage(this.chatId, this.messagePlanListId?.toString());
              } catch (error) {
                console.error(
                  '🚀 ~ ExampleToolExecutionCallback ~ onToolExecution ~ deleteMessage',
                  error.message,
                );
              }
            }
          }
        });

        try {
          this.bot.editMessageText(message, {
            chat_id: this.chatId,
            message_id: this.messagePlanListId,
            parse_mode: 'HTML',
          });
        } catch (error) {
          console.error(
            '🚀 ~ ExampleToolExecutionCallback ~ onToolExecution ~ error',
            error.message,
          );
          return;
        }
      }
      console.log(`Result: ${JSON.stringify(data.data)} `);
    }

    if (data.state === ToolExecutionState.FAILED && data.error) {
      try {
        this.bot.editMessageText(`Error: ${data.error} `, {
          chat_id: this.chatId,
          message_id: this.messageId,
        });
      } catch (error) {
        console.error('🚀 ~ ExampleToolExecutionCallback ~ onToolExecution ~ error', error.message);
      }
    }
  }
}
