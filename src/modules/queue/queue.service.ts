import { QUEUE_NAME, QUEUE_PROCESSOR } from '@/shared/constants/queue';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAME.USER)
    private userQueue: Queue,
  ) {}

  async fetchDataWhenSignUp(username: string) {
    await this.userQueue.add(
      QUEUE_PROCESSOR.USER.FETCH_DATA_WHEN_SIGN_UP,
      {
        username,
      },
      {
        removeOnComplete: 20,
        removeOnFail: true,
      },
    );
  }
}
