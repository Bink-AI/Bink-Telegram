import TelegramBotApi, {
  ChatId,
  SendMessageOptions,
  AnswerCallbackQueryOptions,
} from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';
import { PageResponse, PhotoResponse, TelegramBotState } from './types';
import { parserCallbackMessageTelegram, parserMessageTelegram } from './utils/telegram';
import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { COMMAND_KEYS } from './constants/command-keys';
import { MAX_TIME_STATE_OUT_DATE, USER_INPUT } from './constants/index';
import { Handler } from './handlers/handler';
import process from 'process';
import Redis from 'ioredis';
import { parseCommand } from './utils';
import { isURL } from 'class-validator';
import { SellTokenState, TokenInfoState } from './interfaces';

@Injectable()
export class TelegramBot implements OnApplicationBootstrap {
  name: string;
  channelName: string;
  private loggerService = new Logger(TelegramBot.name);

  public telegramIdStatus: Record<string, number> = {};

  public bot: TelegramBotApi;

  private state: Record<string, TelegramBotState>;

  private handlers: Record<string, Handler>;

  @Inject('TELEGRAM_BOT_STATE')
  private botStateStore: Redis;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('telegram.token');
    const isBot = Boolean(Number(process.env.IS_BOT || 0));
    if (isBot) {
      this.bot = new TelegramBotApi(token, { polling: true });
    } else {
      this.bot = new TelegramBotApi(token, { polling: false });
    }
    this.state = {};
  }
  onApplicationBootstrap() {
    this.bot.getMe().then(rs => {
      this.name = rs.username;
      this.loggerService.log(`Telegram bot run name: ${this.name}`);
    });
    process.env.CHANNEL_ID &&
      this.bot
        .getChat(process.env.CHANNEL_ID)
        .then(rs => {
          this.channelName = rs.username;
        })
        .catch(err => {
          console.log(
            '🚀 ~ file: telegram-bot.ts:60 ~ TelegramBot ~ onApplicationBootstrap ~ err:',
            err,
          );
        });
  }

  async sendMessage(chatId: ChatId, text: string, options?: SendMessageOptions) {
    return this.bot.sendMessage(chatId, text, options);
  }

  async sendPageMessage(chatId: ChatId, data: PageResponse) {
    try {
      return this.bot.sendMessage(chatId, data.text, data.menu);
    } catch (error) {
      console.log('🚀 ~ file: telegram-bot.ts:97 ~ error:', error);
    }
  }

  async sendPagePhoto(chatId: ChatId, data: PhotoResponse) {
    try {
      return await this.bot.sendPhoto(chatId, data.photo, data.menu);
    } catch (error) {
      console.log('🚀 ~ file: telegram-bot.ts:105 ~ error:', error?.message);
    }
  }

  async deleteMessage(chatId: ChatId, messageId: string) {
    try {
      return await this.bot.deleteMessage(chatId, parseInt(messageId));
    } catch (error) {
      console.error('🚀 ~ TelegramBot ~ deleteMessage ~ error', error.message);
      return null;
    }
  }

  setupStartCommand(callback: any) {
    this.bot.onText(/\/start/, msg => {
      callback(parserMessageTelegram(msg));
    });
  }

  setupWalletCommand(callback: any) {
    this.bot.onText(/\/wallets/, msg => {
      callback(parserMessageTelegram(msg));
    });
  }

  setupBuyCommand(callback: any) {
    this.bot.onText(/\/buy/, msg => {
      callback(parserMessageTelegram(msg));
    });
  }

  setupHelpCommand(callback: any) {
    this.bot.onText(/\/help/, msg => {
      callback(parserMessageTelegram(msg));
    });
  }

  setupReferralCommand(callback: any) {
    this.bot.onText(/\/referral/, msg => {
      callback(parserMessageTelegram(msg));
    });
  }

  // sell
  setupSellCommand(callback: any) {
    this.bot.onText(/\/sell/, msg => {
      callback(parserMessageTelegram(msg));
    });
  }

  setupClearCommand(callback: any) {
    this.bot.onText(/\/clear/, msg => {
      callback(parserMessageTelegram(msg));
    });
  }

  setupMenuCallback(callback: any) {
    this.bot.on('callback_query', query => {
      const { data: action } = query;
      const data = parserCallbackMessageTelegram(query);

      callback(action, { ...data, cmd: action });
    });
  }

  userReply(callback: any) {
    this.bot.on('message', msg => {
      if (isURL(msg.text)) {
        this.bot.sendMessage(msg.chat.id, 'open this', {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  web_app: {
                    url: msg.text,
                  },
                  text: '🔫',
                },
              ],
            ],
          },
        });
      }

      // Add photo to the parsed message if present
      const parsedMessage = parserMessageTelegram(msg);
      if (msg.photo && parsedMessage) {
        // Create a new object with the photo property
        const messageWithPhoto = {
          ...parsedMessage,
          photo: msg.photo,
          caption: msg.caption,
        };
        callback(messageWithPhoto);
        return;
      }

      callback(parserMessageTelegram(msg));
    });
  }

  registerHandlers(handlers: Record<string, Handler>) {
    this.handlers = handlers;
  }

  async start() {
    const startHandler = this.handlers[COMMAND_KEYS.START];
    const walletsHandler = this.handlers[COMMAND_KEYS.WALLETS];
    const buyHandler = this.handlers[COMMAND_KEYS.BUY];
    const sellHandler = this.handlers[COMMAND_KEYS.SELL];
    const helpHandler = this.handlers[COMMAND_KEYS.HELP];
    const referralHandler = this.handlers[COMMAND_KEYS.REFERRAL];
    const clearHandler = this.handlers[COMMAND_KEYS.CLEAR];
    if (startHandler) {
      this.setupStartCommand(startHandler.handler);
    }

    if (walletsHandler) {
      this.setupWalletCommand(walletsHandler.handler);
    }

    if (buyHandler) {
      this.setupBuyCommand(buyHandler.handler);
    }

    if (sellHandler) {
      this.setupSellCommand(sellHandler.handler);
    }

    if (helpHandler) {
      this.setupHelpCommand(helpHandler.handler);
    }

    if (referralHandler) {
      this.setupReferralCommand(referralHandler.handler);
    }

    if (clearHandler) {
      this.setupClearCommand(clearHandler.handler);
    }

    this.setupMenuCallback((cmd, data) => {
      // Handle human review callbacks directly
      if (cmd === COMMAND_KEYS.HUMAN_REVIEW_YES || cmd === COMMAND_KEYS.HUMAN_REVIEW_NO) {
        const handler = this.handlers[cmd];
        if (handler) {
          handler
            .handler({ ...data, cmd })
            .then()
            .catch(e => {
              this.loggerService.error(e, {
                file: 'TelegramBot.start',
                text: `handler command ${cmd} error: `,
              });
            });
        }
        return;
      }

      // Handle other callbacks as before
      const { cmd: _cmd, params } = parseCommand(cmd);
      const handler = this.handlers[_cmd];
      if (handler) {
        if (params && (handler as any)?.setConfig) {
          (handler as any).setConfig(params);
        }
        handler
          .handler({ ...data, ...params })
          .then()
          .catch(e => {
            this.loggerService.error(e, {
              file: 'TelegramBot.start',
              text: `handler command ${_cmd} error: `,
            });
          });
      } else {
        this.loggerService.log('unknown callback:', { _cmd });
      }
    });

    this.userReply(this.handlers[USER_INPUT].handler);
  }

  /**
   *
   * @param telegramId
   * @returns
   */
  async getUrlAvatar(telegramId: number) {
    const result = await this.bot.getUserProfilePhotos(telegramId, 0 as any); // TODO: recheck
    const fileId =
      result.photos.length > 0 && result.photos[0].length > 0 ? result.photos[0][0].file_id : null;

    if (!fileId) {
      return null;
    }

    const link = await this.bot.getFileLink(fileId);
    const avatarLink = link.toString();

    return avatarLink;
  }

  async getCheckMember(chatId: ChatId, userId: number) {
    const checkMember = await this.bot.getChatMember(chatId, userId);
    return checkMember;
  }

  async getBoostsChannel(chatId: ChatId, userId: number) {
    const url = 'https://api.telegram.org/bot';
    const token = this.configService.get<string>('telegram.token');
    const res = await fetch(`${url}${token}/getUserChatBoosts?chat_id=${chatId}&user_id=${userId}`);
    const data = await res.json();
    const boosts = data?.result?.boosts;
    return boosts;
  }

  async answerCallbackQuery(callbackQueryId: string, options?: AnswerCallbackQueryOptions) {
    return this.bot.answerCallbackQuery(callbackQueryId, options);
  }

  async editMessageText(text: string, options: any) {
    try {
      return await this.bot.editMessageText(text, options);
    } catch (error) {
      console.error('Error in TelegramBot.editMessageText:', error.message);
      return null;
    }
  }

  async getTokenInfoState(telegramId: string): Promise<TokenInfoState | null> {
    const state = await this.botStateStore.get(`user:${telegramId}:token_info`);
    return state ? JSON.parse(state) : null;
  }

  async getSellTokenState(telegramId: string): Promise<SellTokenState | null> {
    const state = await this.botStateStore.get(`user:${telegramId}:sell_token`);
    return state ? JSON.parse(state) : null;
  }

  async setSellTokenState(telegramId: string, state: Partial<SellTokenState>) {
    const currentState = await this.getSellTokenState(telegramId);
    const newState = {
      ...currentState,
      ...state,
      updatedAt: Date.now(),
    };
    await this.botStateStore.set(`user:${telegramId}:sell_token`, JSON.stringify(newState));
    return newState;
  }

  async setTokenInfoState(telegramId: string, state: Partial<TokenInfoState>) {
    const currentState = await this.getTokenInfoState(telegramId);
    const newState = {
      ...currentState,
      ...state,
      updatedAt: Date.now(),
    };
    await this.botStateStore.set(`user:${telegramId}:token_info`, JSON.stringify(newState));
    return newState;
  }

  buildBuyUrl(address: string) {
    return `https://t.me/${this.name}?start=buy_${address}`;
  }
}
