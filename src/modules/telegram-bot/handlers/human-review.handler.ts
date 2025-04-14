import { Inject, Injectable } from "@nestjs/common";
import { TelegramBot } from "../telegram-bot";
import { Handler } from "./handler";
import { EHumanReviewAction, EMessageType } from "@/shared/constants/enums";
import { AiService } from "@/business/services/ai.service";

@Injectable()
export class HumanReviewHandler implements Handler {
    constructor(
        @Inject(TelegramBot)
        private readonly bot: TelegramBot,
        @Inject(AiService)
        private readonly aiService: AiService,
    ) { }

    handler = async (data: {
        chatId: string;
        telegramId: string;
        messageId: number;
        queryId: string;
        cmd: string;
    }) => {
        try {
            // Answer the callback query to remove the loading state
            await this.bot.answerCallbackQuery(data.queryId);

            // Determine the action based on the user's response
            const action = data.cmd === 'human_review_yes' ? EHumanReviewAction.APPROVE : EHumanReviewAction.REJECT;

            // Send the response with the action
            await this.aiService.handleSwap(data.telegramId, '', action as EHumanReviewAction);

            // Delete the original message with buttons
            await this.bot.deleteMessage(data.chatId, data.messageId.toString());
        } catch (error) {
            console.error('Error in HumanReviewHandler:', error);
            await this.bot.sendMessage(
                data.chatId,
                "Error processing your response. Please try again."
            );
        }
    };
} 