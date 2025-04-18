import { ChatId } from "node-telegram-bot-api";
import { Inject, Injectable } from "@nestjs/common";
import { TelegramBot } from "../telegram-bot";
import { Handler } from "../handlers/handler";
import { MainPage } from "../ui/pages/main.page";
import { UserService } from "@/business/services/user.service";
import { TokenInfoHandler } from "./token-info.handler";
import { COMMAND_KEYS } from "../constants/command-keys";

@Injectable()
export class StartHandler implements Handler {
  constructor(
    private readonly bot: TelegramBot,
    private readonly userService: UserService,
  ) { }

  handler = async (data: {
    chatId: ChatId;
    telegramId: string;
    firstName: string;
    username: string;
    text: string;
    messageId?: number;
  }) => {
    const text = data.text?.trim();
    console.log("🚀 ~ StartHandler ~ data:", data)


    //link=https://t.me/BinkAI_bot?start=i_7upWrrBp
    const referralCode = text?.replace("/start ", "").trim();

    // Get or create user with telegram info
    const user = await this.userService.getOrCreateUser({
      telegram_id: data.telegramId,
      telegram_username: data.username,
      telegram_name: data.firstName,
      referral_code: referralCode,
    });

    // Display main page with user info
    await this.bot.sendPagePhoto(data.chatId, new MainPage().build());

    if ('ops' in data && data?.ops === COMMAND_KEYS.START) {
      await this.bot.deleteMessage(data.chatId, data.messageId.toString());
    }
  };
}
