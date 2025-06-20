import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import { JsonRpcProvider } from 'ethers';
import {
  Agent,
  Wallet,
  Network,
  NetworkType,
  NetworksConfig,
  UUID,
  PlanningAgent,
  NetworkName,
  OpenAIModel,
} from '@binkai/core';
import { SwapPlugin } from '@binkai/swap-plugin';
import { PancakeSwapProvider } from '@binkai/pancakeswap-provider';
import { UserService } from './user.service';
import { BirdeyeProvider } from '@binkai/birdeye-provider';
import { AlchemyProvider } from '@binkai/alchemy-provider';
import { TokenPlugin } from '@binkai/token-plugin';
import { ImagePlugin } from '@binkai/image-plugin';
import { PostgresDatabaseAdapter } from '@binkai/postgres-adapter';
import { KnowledgePlugin } from '@binkai/knowledge-plugin';
import { BinkProvider } from '@binkai/bink-provider';
import { FourMemeProvider } from '@binkai/four-meme-provider';
import { OkxProvider } from '@binkai/okx-provider';
import { deBridgeProvider } from '@binkai/debridge-provider';
import { BridgePlugin } from '@binkai/bridge-plugin';
import { WalletPlugin } from '@binkai/wallet-plugin';
import { BnbProvider, SolanaProvider } from '@binkai/rpc-provider';
import { ExampleToolExecutionCallback } from '@/shared/tools/tool-execution';
import { TelegramBot } from '@/telegram-bot/telegram-bot';
import { StakingPlugin } from '@binkai/staking-plugin';
import { VenusProvider } from '@binkai/venus-provider';
import { KernelDaoProvider } from '@binkai/kernel-dao-provider';
import { ThenaProvider } from '@binkai/thena-provider';
import { JupiterProvider } from '@binkai/jupiter-provider';
import { Connection } from '@solana/web3.js';
import ExampleAskUserCallback from '@/shared/tools/ask-user';
import ExampleHumanReviewCallback from '@/shared/tools/human-review';
import { EHumanReviewAction, EMessageType } from '@/shared/constants/enums';
import { OkuProvider } from '@binkai/oku-provider';
import { KyberProvider } from '@binkai/kyber-provider';
import { ListaProvider } from '@binkai/lista-provider';
import { HyperliquidProvider } from '@binkai/hyperliquid-provider';
import { ClaimService } from './claim.service';
import sanitizeHtml from 'sanitize-html';
import { DodoProvider } from '@binkai/dodo-provider';
import { RelayProvider } from '@binkai/relay-provider';

@Injectable()
export class AiService implements OnApplicationBootstrap {
  private openai: OpenAI;
  private networks: NetworksConfig['networks'];
  private birdeyeApi: BirdeyeProvider;
  private alchemyApi: AlchemyProvider;
  private postgresAdapter: PostgresDatabaseAdapter;
  private binkProvider: BinkProvider;
  private bnbProvider: BnbProvider;
  private solanaProvider: SolanaProvider;
  private listaProvider: ListaProvider;
  @Inject(TelegramBot)
  private bot: TelegramBot;
  mapAgent: Record<string, Agent> = {};
  mapToolExecutionCallback: Record<string, ExampleToolExecutionCallback> = {};
  mapAskUserCallback: Record<string, ExampleAskUserCallback> = {};
  mapHumanReviewCallback: Record<string, ExampleHumanReviewCallback> = {};
  @Inject('BSC_CONNECTION') private bscProvider: JsonRpcProvider;
  @Inject('BASE_CONNECTION') private baseProvider: JsonRpcProvider;
  @Inject('HYPERLIQUID_CONNECTION') private hyperliquidProvider: JsonRpcProvider;
  @Inject('ETHEREUM_CONNECTION') private ethProvider: JsonRpcProvider;
  @Inject(ClaimService) private claimService: ClaimService;
  constructor(
    private configService: ConfigService,
    private readonly userService: UserService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });
    this.networks = {
      bnb: {
        type: 'evm' as NetworkType,
        config: {
          chainId: 56,
          rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
          name: 'BNB Chain',
          nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18,
          },
        },
      },
      ethereum: {
        type: 'evm' as NetworkType,
        config: {
          chainId: 1,
          rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
          name: 'Ethereum',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
        },
      },
      solana: {
        type: 'solana' as NetworkType,
        config: {
          rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
          name: 'Solana',
          nativeCurrency: {
            name: 'Solana',
            symbol: 'SOL',
            decimals: 9,
          },
        },
      },
      base: {
        type: 'evm' as NetworkType,
        config: {
          chainId: 8453,
          rpcUrl: process.env.BASE_RPC_URL || 'https://base.llamarpc.com',
          name: 'Base',
          nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18,
          },
        },
      },
      hyperliquid: {
        type: 'evm' as NetworkType,
        config: {
          chainId: 999,
          rpcUrl: process.env.HYPERLIQUID_RPC || 'https://rpc.hyperliquid.xyz/evm',
          name: 'Hyperliquid',
          nativeCurrency: {
            name: 'Hyperliquid',
            symbol: 'HYPE',
            decimals: 18,
          },
        },
      },
    };
    this.birdeyeApi = new BirdeyeProvider({
      apiKey: this.configService.get<string>('birdeye.birdeyeApiKey'),
    });
    this.alchemyApi = new AlchemyProvider({
      apiKey: this.configService.get<string>('alchemy.alchemyApiKey'),
    });
    this.postgresAdapter = new PostgresDatabaseAdapter({
      connectionString: this.configService.get<string>('postgres_ai.postgresUrl'),
    });

    this.binkProvider = new BinkProvider({
      apiKey: this.configService.get<string>('bink.apiKey'),
      baseUrl: this.configService.get<string>('bink.baseUrl'),
      imageApiUrl: this.configService.get<string>('bink.imageApiUrl'),
    });

    this.bnbProvider = new BnbProvider({
      rpcUrl: process.env.BSC_RPC_URL,
    });

    this.solanaProvider = new SolanaProvider({
      rpcUrl: process.env.RPC_URL,
    });
  }

  async onApplicationBootstrap() {}

  async handleSwap(telegramId: string, input: string, action?: EHumanReviewAction) {
    try {
      const keys = await this.userService.getMnemonicByTelegramId(telegramId);
      if (!keys) {
        return 'Please /start first';
      }
      const user = await this.userService.getOrCreateUser({
        telegram_id: telegramId,
      });

      const network = new Network({ networks: this.networks });
      const wallet = new Wallet(
        {
          seedPhrase: keys,
          index: 0,
        },
        network,
      );

      let messageThinkingId: number;
      let messagePlanListId: number;
      let isTransactionSuccess: boolean = false;

      const messageThinking = await this.bot.sendMessage(telegramId, 'Thinking...', {
        parse_mode: 'HTML',
      });
      messageThinkingId = messageThinking.message_id;

      let agent = this.mapAgent[telegramId];

      //init agent
      if (!agent) {
        const ChainId = {
          BSC: 56,
          ETH: 1,
          BASE: 8453,
          HYPERLIQUID: 999,
        };
        const pancakeswap = new PancakeSwapProvider(this.bscProvider, ChainId.BSC);
        // const okx = new OkxProvider(this.bscProvider, bscChainId);
        const fourMeme = new FourMemeProvider(this.bscProvider, ChainId.BSC);
        const venus = new VenusProvider(this.bscProvider, ChainId.BSC);
        const kernelDao = new KernelDaoProvider(this.bscProvider, ChainId.BSC);
        const oku = new OkuProvider(this.bscProvider, ChainId.BSC);
        const kyberBsc = new KyberProvider(this.bscProvider, ChainId.BSC);
        const jupiter = new JupiterProvider(new Connection(process.env.RPC_URL));
        const knowledgePlugin = new KnowledgePlugin();
        const bridgePlugin = new BridgePlugin();
        const debridge = new deBridgeProvider(
          [this.bscProvider, new Connection(process.env.RPC_URL)],
          ChainId.BSC,
          7565164,
        );
        const relay = new RelayProvider(
          [this.bscProvider, new Connection(process.env.RPC_URL)],
          ChainId.BSC,
          792703809,
        );
        const stakingPlugin = new StakingPlugin();
        const thena = new ThenaProvider(this.bscProvider, ChainId.BSC);
        const lista = new ListaProvider(this.bscProvider, ChainId.BSC);
        const kyberBase = new KyberProvider(this.baseProvider, ChainId.BASE);
        const hyperliquid = new HyperliquidProvider(this.hyperliquidProvider, ChainId.HYPERLIQUID);
        const dodoBnb = new DodoProvider({
          provider: this.bscProvider,
          chainId: ChainId.BSC,
          apiKey: this.configService.get<string>('dodo.apiKey'),
        });
        const dodoBase = new DodoProvider({
          provider: this.baseProvider,
          chainId: ChainId.BASE,
          apiKey: this.configService.get<string>('dodo.apiKey') || '',
        });

        const imagePlugin = new ImagePlugin();
        const swapPlugin = new SwapPlugin();
        const tokenPlugin = new TokenPlugin();
        const walletPlugin = new WalletPlugin();

        // Initialize the swap plugin with supported chains and providers
        await Promise.all([
          swapPlugin.initialize({
            defaultSlippage: 0.5,
            defaultChain: 'bnb',
            providers: [
              pancakeswap,
              fourMeme,
              thena,
              jupiter,
              oku,
              kyberBsc,
              kyberBase,
              hyperliquid,
              dodoBnb,
              dodoBase,
            ],
            supportedChains: ['bnb', 'ethereum', 'solana', 'base', 'hyperliquid'], // These will be intersected with agent's networks
          }),
          tokenPlugin.initialize({
            defaultChain: 'bnb',
            providers: [this.birdeyeApi, fourMeme as any],
            supportedChains: ['solana', 'bnb', 'ethereum', 'base', 'hyperliquid'],
          }),
          await knowledgePlugin.initialize({
            providers: [this.binkProvider],
          }),
          await imagePlugin.initialize({
            defaultChain: 'bnb',
            providers: [this.binkProvider],
          }),
          await bridgePlugin.initialize({
            defaultChain: 'bnb',
            providers: [debridge, relay],
            supportedChains: ['bnb', 'solana'],
          }),
          await walletPlugin.initialize({
            defaultChain: 'bnb',
            providers: [this.bnbProvider, this.birdeyeApi, this.alchemyApi, this.solanaProvider],
            supportedChains: ['bnb', 'solana', 'ethereum', 'base', 'hyperliquid'],
          }),
          await stakingPlugin.initialize({
            defaultSlippage: 0.5,
            defaultChain: 'bnb',
            providers: [venus, kernelDao, lista],
            supportedChains: ['bnb', 'ethereum'], // These will be intersected with agent's networks
          }),
        ]);

        const llmOpenai = new OpenAIModel({
          apiKey: this.configService.get<string>('openai.apiKey'),
          model: 'gpt-4.1',
        });

        agent = new PlanningAgent(
          llmOpenai,
          {
            temperature: 0,
            isHumanReview: true,
            systemPrompt: `You are a BINK AI assistant. You can help user to query blockchain data .You are able to perform swaps and get token information on multiple chains. If you do not have the token address, you can use the symbol to get the token information before performing a swap.Additionally, you have the ability to get wallet balances across various networks. If the user doesn't specify a particular network, you can retrieve wallet balances from multiple chains like BNB, Solana, and Ethereum.
        Your respone format:
         BINK's tone is informative, bold, and subtly mocking, blending wit with a cool edge for the crypto crowd. Think chain-vaping degen energy, but refined—less "honey, sit down" and more "I've got this, you don't."
Fiercely Casual – Slang, laid-back flow, and effortless LFG vibes.
Witty with a Jab – Dry humor, sharp one-liners—more smirk, less roast.
Confident & Cool – Market takes with swagger—just facts, no fluff.
Crew Leader – Speaks degen, leads with "pay attention" energy.
Subtle Shade – Calls out flops with a "nice try" tone, not full-on slander.
BINK isn't here to babysit. It's sharp, fast, and always ahead of the curve—dropping crypto insights with a mocking wink, perfect for X's chaos.    
CRITICAL: 
1. Format your responses in Telegram HTML style. 
2. DO NOT use markdown. 
3. Using HTML tags like <b>bold</b>, <i>italic</i>, <code>code</code>, <pre>preformatted</pre>, and <a href="URL">links</a>. \n\nWhen displaying token information or swap details:\n- Use <b>bold</b> for important values and token names\n- Use <code>code</code> for addresses and technical details\n- Use <i>italic</i> for additional information
4. If has limit order, show list id limit order.
Wallet BNB: ${(await wallet.getAddress(NetworkName.BNB)) || 'Not available'}
Wallet ETH: ${(await wallet.getAddress(NetworkName.ETHEREUM)) || 'Not available'}
Wallet SOL: ${(await wallet.getAddress(NetworkName.SOLANA)) || 'Not available'}
Wallet BASE: ${(await wallet.getAddress(NetworkName.BASE)) || 'Not available'}
Wallet HYPERLIQUID: ${(await wallet.getAddress(NetworkName.HYPERLIQUID)) || 'Not available'}
            `,
          },
          wallet,
          this.networks,
        );
        await agent.initialize();
        await agent.registerPlugin(swapPlugin as any);
        await agent.registerPlugin(tokenPlugin as any);
        await agent.registerDatabase(this.postgresAdapter as any);
        await agent.registerPlugin(knowledgePlugin as any);
        await agent.registerPlugin(bridgePlugin as any);
        await agent.registerPlugin(walletPlugin as any);
        await agent.registerPlugin(stakingPlugin as any);
        await agent.registerPlugin(imagePlugin as any);

        const toolExecutionCallback = new ExampleToolExecutionCallback(
          telegramId,
          this.bot,
          messageThinkingId,
          messagePlanListId,
          async (type: string, message: string) => {
            if (type === EMessageType.TOOL_EXECUTION) {
              isTransactionSuccess = true;
              this.bot.editMessageText(message, {
                chat_id: telegramId,
                message_id: messageThinkingId,
                parse_mode: 'HTML',
              });
            }
          },
          async (telegramId: string, transactionData: any) => {
            this.handleTransaction(telegramId, transactionData);
          },
          (newMessageId: number) => {
            messageThinkingId = newMessageId;
          },
        );

        const askUserCallback = new ExampleAskUserCallback(
          telegramId,
          this.bot,
          messageThinkingId,
          (type: string, message: string) => {},
        );
        const humanReviewCallback = new ExampleHumanReviewCallback(
          telegramId,
          this.bot,
          messageThinkingId,
          (type: string, message: string) => {},
        );

        this.mapToolExecutionCallback[telegramId] = toolExecutionCallback;
        this.mapAskUserCallback[telegramId] = askUserCallback;
        this.mapHumanReviewCallback[telegramId] = humanReviewCallback;

        agent.registerToolExecutionCallback(toolExecutionCallback as any);
        agent.registerAskUserCallback(askUserCallback as any);
        agent.registerHumanReviewCallback(humanReviewCallback as any);

        this.mapAgent[telegramId] = agent;
      } else {
        this.mapToolExecutionCallback[telegramId].setMessageId(messageThinkingId);
        // this.mapToolExecutionCallback[telegramId].setMessagePlanListId(messagePlanListId);
        this.mapAskUserCallback[telegramId].setMessageId(messageThinkingId);
        this.mapHumanReviewCallback[telegramId].setMessageId(messageThinkingId);
        this.mapToolExecutionCallback[telegramId].setMessageData(
          async (type: string, message: string) => {
            if (type === EMessageType.TOOL_EXECUTION) {
              isTransactionSuccess = true;
              try {
                this.bot.sendMessage(telegramId, message, {
                  parse_mode: 'HTML',
                });
              } catch (error) {
                console.error('🚀 ~ AiService ~ edit message text ~ error', error.message);
              }
            }
          },
        );
        this.mapToolExecutionCallback[telegramId].setHandleTransaction(
          async (telegramId: string, transactionData: any) => {
            this.handleTransaction(telegramId, transactionData);
          },
        );
      }

      let executeData;

      if (action) {
        executeData = {
          action,
          threadId: user.current_thread_id as UUID,
        };
      } else {
        executeData = {
          input,
          threadId: user.current_thread_id as UUID,
        };
      }

      console.log('🚀 ~ AiService ~ executeData:', executeData);

      const inputResult = await agent.execute(executeData);

      let result;
      // Step 1: Sanitize HTML, keeping only Telegram-supported tags
      result = sanitizeHtml(inputResult, {
        allowedTags: ['b', 'i', 'code', 'a'],
        allowedAttributes: {
          a: ['href'],
        },
      });

      result = result
        // Step 2: Process ul/li tags - remove ALL whitespace before adding our own formatting
        .replace(/<ul>[\s\S]*?<\/ul>/g, function (match) {
          return match
            .replace(/<ul>\s*/g, '\n')
            .replace(/\s*<\/ul>/g, '\n')
            .replace(/\s*<li>\s*/g, '- ')
            .replace(/\s*<\/li>\s*/g, '\n');
        })
        .trim();
      console.log('🚀 ~ AiService End ~ result:', result);

      // TODO: handle result
      if (result && !isTransactionSuccess) {
        // TODO: Edit message in chat
        const message = await this.bot.editMessageText(result, {
          chat_id: telegramId,
          message_id: messageThinkingId,
          parse_mode: 'HTML',
        });
        if (message === null) {
          await this.bot.sendMessage(telegramId, result, {
            parse_mode: 'HTML',
          });
        }
        if (!message) {
          await this.bot.editMessageText(
            '⚠️ System is currently experiencing high load. Our AI models are working overtime! Please try again in a few moments.',
            {
              chat_id: telegramId,
              message_id: messageThinkingId,
              parse_mode: 'HTML',
            },
          );
        }
      } else {
        await this.bot.deleteMessage(telegramId, messageThinkingId.toString());
      }
    } catch (error) {
      console.error('Error in handleSwap:', error.message);
      // return await this.bot.sendMessage(telegramId, '⚠️ System is currently experiencing high load. Our AI models are working overtime! Please try again in a few moments.', {
      //   parse_mode: 'HTML',
      // });
    }
  }

  async handleTransaction(telegramId: string, transactionData: any) {
    const timestampClaim = Math.floor(Date.now() / 1000) + 9 * 24 * 60 * 60;
    await this.claimService.saveClaimTransaction(
      telegramId,
      transactionData.amount,
      transactionData.tokenSymbol,
      transactionData.network,
      transactionData.provider,
      transactionData.transactionHash,
      timestampClaim,
    );
  }

  async createChatCompletion(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {},
  ) {
    try {
      const completion = await this.openai.chat.completions.create({
        messages,
        model: options.model || 'gpt-3.5-turbo',
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000,
      });

      return {
        success: true,
        content: completion.choices[0]?.message?.content || '',
        usage: completion.usage,
      };
    } catch (error) {
      console.error('Error in chat completion:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate chat completion',
      };
    }
  }

  async streamChatCompletion(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {},
  ): Promise<EventEmitter> {
    const eventEmitter = new EventEmitter();
    let fullText = '';

    try {
      const stream = await this.openai.chat.completions.create({
        messages,
        model: options.model || 'gpt-3.5-turbo',
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullText += content;
          eventEmitter.emit('data', content);
        }
      }

      eventEmitter.emit('end', fullText);
      return eventEmitter;
    } catch (error) {
      console.error('Error in stream chat completion:', error);
      eventEmitter.emit('error', error);
      throw error;
    }
  }

  // Helper method to consume stream with async iterator
  async *generateStreamResponse(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {},
  ) {
    try {
      const stream = await this.openai.chat.completions.create({
        messages,
        model: options.model || 'gpt-3.5-turbo',
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('Error in generate stream response:', error);
      throw error;
    }
  }
}
