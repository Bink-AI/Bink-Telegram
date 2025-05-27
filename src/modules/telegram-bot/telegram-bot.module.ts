import { DatabaseModule } from "@/database";
import { Global, Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { configTelegram } from "./configs/telegram";
import { TelegramBot } from "./telegram-bot";
import Redis from "ioredis";
import { HandlerService } from "./services/handler.service";
import { StartHandler } from "./handlers/start.handler";
import { OpenMiniAppHandler } from "./handlers/open-mini-app.handler";
import { UserInputHandler } from "./handlers/user-input.handler";
import { BuyHandler } from "./handlers/buy.handler";
import { TokenInfoHandler } from "./handlers/token-info.handler";
import { CustomAmountHandler } from "./handlers/custom-amount.handler";
import { ConfirmBuyHandler } from "./handlers/confirm-buy.handler";
import { SellHandler } from "./handlers/sell.handler";
import { SellTokenDetailHandler } from "./handlers/sell-token-detail.handler";
import { ConfirmSellHandler } from "./handlers/confirm-sell.handler";
import { WalletHandler } from "./handlers/wallet.handler";
import { ExportKeysHandler } from "./handlers/export-keys.handler";
import { ComingSoonHandler } from "./handlers/coming-soon.handler";
import { WithdrawHandler } from "./handlers/withdraw.handler";
import { CustomPercentageHandler } from "./handlers/custom-percentage.handler";
import { TestController } from "./controllers/test.controller";
import { HelpHandler } from "./handlers/help.handler";
import { ReferralHandler } from "./handlers/referral.handler";
import { ClearHandler } from "./handlers/clear.handler";
import { HumanReviewHandler } from "./handlers/human-review.handler";

// ✅ New handler for AI-generated tweet suggestions
import { TweetifyHandler } from "./handlers/tweetify.handler";

const handlers = [
  StartHandler,
  OpenMiniAppHandler,
  UserInputHandler,
  BuyHandler,
  TokenInfoHandler,
  CustomAmountHandler,
  ConfirmBuyHandler,
  SellHandler,
  SellTokenDetailHandler,
  ConfirmSellHandler,
  WalletHandler,
  ComingSoonHandler,
  WithdrawHandler,
  CustomPercentageHandler,
  HelpHandler,
  ReferralHandler,
  TweetifyHandler, // ✅ Registered here
];

const services = [HandlerService];

@Global()
@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configTelegram],
    }),
  ],
  controllers: [TestController],
  providers: [
    ...handlers,
    TelegramBot,
    ...services,
    {
      provide: "TELEGRAM_BOT_STATE",
      useFactory: (configService: ConfigService) => {
        const family =
          configService.get<number>("telegram.state.family") ||
          Number(process.env.REDIS_FAMILY || 0);
        const url =
          configService.get<string>("telegram.state.url") + `?family=${family}`;
        const redis = new Redis(url);
        return redis;
      },
      inject: [ConfigService],
    },
    {
      provide: "REDIS_STATE",
      useFactory: (configService: ConfigService) => {
        const family = configService.get<number>("telegram.state.family");
        const url =
          configService.get<string>("telegram.state.url") + `?family=${family}`;
        const redis = new Redis(url);

        return redis;
      },
      inject: [ConfigService],
    },
    SellTokenDetailHandler,
    ConfirmSellHandler,
    ExportKeysHandler,
    ClearHandler,
    HumanReviewHandler,
  ],
  exports: [TelegramBot],
})
export class TelegramBotModule implements OnModuleInit {
  constructor(
    private telegramBot: TelegramBot,
    private handlerService: HandlerService
  ) { }
  async onModuleInit() {
    const handlers = this.handlerService.getHandlers();
    this.telegramBot.registerHandlers(handlers);
    await this.telegramBot.start();
  }
}
