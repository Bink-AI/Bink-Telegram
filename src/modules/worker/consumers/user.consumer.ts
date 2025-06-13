import { QUEUE_NAME, QUEUE_PROCESSOR } from '@/shared/constants/queue';
import { OnQueueCompleted, Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

@Processor(QUEUE_NAME.USER)
export class UserConsumer {
  constructor() {}

  @Process(QUEUE_PROCESSOR.USER.FETCH_DATA_WHEN_SIGN_UP)
  async processFetchDataWhenSignUp(
    job: Job<{
      username: string;
    }>,
  ) {
    const { username } = job.data;
  }

  @OnQueueCompleted()
  async onQueueCompleted(job: Job<any>) {}
}
