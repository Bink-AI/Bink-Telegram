import { CommandHandler, Handler } from '@nestjs/cqrs';
import { TelegramCommand } from '../commands/telegram.command';
import { TelegramService } from '../telegram.service';
import { Inject } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { Configuration, OpenAIApi } from 'openai';

const userUsage = new Map<number, number>();
const FREE_LIMIT = 5;
const FEE_BNB = 0.015;

@CommandHandler(TelegramCommand)
export class TweetifyHandler implements Handler<TelegramCommand> {
  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    @Inject(WalletService) private readonly walletService: WalletService,
  ) {}

  async execute(command: TelegramCommand): Promise<void> {
    const { message, args } = command;
    const userId = message.from.id;
    const username = args?.[0];

    if (!username) {
      this.telegram.sendMessage(message.chat.id, 'Usage: /tweetify <twitter_username>');
      return;
    }

    const usage = userUsage.get(userId) || 0;

    if (usage >= FREE_LIMIT) {
      const wallet = await this.walletService.getWallet(userId);
      const success = await this.walletService.transfer({
        from: wallet.address,
        to: this.config.get('BNB_COLLECTOR_ADDRESS'),
        amount: FEE_BNB,
      });
      if (!success) {
        this.telegram.sendMessage(message.chat.id, '❌ Payment failed or insufficient balance.');
        return;
      }
      this.telegram.sendMessage(message.chat.id, `💸 Pro Plan: Deducted ${FEE_BNB} BNB.`);
    } else {
      this.telegram.sendMessage(message.chat.id, `🆓 Free Plan: ${FREE_LIMIT - usage} suggestions remaining.`);
    }

    this.telegram.sendMessage(message.chat.id, `📥 Fetching tweets for @${username}...`);

    const tweets = await this.scrapeTweets(username);
    if (!tweets.length) {
      this.telegram.sendMessage(message.chat.id, `No tweets found for @${username}`);
      return;
    }

    const topics = this.extractTopics(tweets);
    const tweet = await this.generateTweet(topics);

    userUsage.set(userId, usage + 1);

    this.telegram.sendMessage(message.chat.id, `🔍 Topics: ${topics.join(', ')}\n\n✍️ Suggested Tweet:\n${tweet}`);
  }

  async scrapeTweets(username: string): Promise<string[]> {
    const res = await fetch(`https://api.scraper.bink.sh/twitter/${username}`);
    const data = await res.json();
    return data.tweets.slice(0, 100);
  }

  extractTopics(tweets: string[]): string[] {
    const allText = tweets.join(' ');
    const words = allText.split(/\s+/);
    const freq: Record<string, number> = {};

    for (const word of words) {
      const clean = word.toLowerCase().replace(/[^a-z#]/g, '');
      if (clean.length > 4) {
        freq[clean] = (freq[clean] || 0) + 1;
      }
    }

    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 5);

    return sorted;
  }

  async generateTweet(topics: string[]): Promise<string> {
    const configuration = new Configuration({
      apiKey: this.config.get('OPENAI_API_KEY'),
    });
    const openai = new OpenAIApi(configuration);

    const prompt = `Create a tweet about one of the following topics: ${topics.join(', ')}. Make it engaging and under 280 characters.`;
    const res = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    return res.data.choices[0].message?.content || 'Unable to generate tweet.';
  }
}
