import { Module } from '@nestjs/common';
import { configDb } from './configs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity, AdminConfigEntity, TransactionEntity, UserReferralEntity } from './entities';
import {
  UserRepository,
  AdminConfigRepository,
  TransactionRepository,
  UserReferralRepository,
} from './repositories';
import { SeedDatabase } from './seeders/seed.database';

const repositories = [
  UserRepository,
  AdminConfigRepository,
  TransactionRepository,
  UserReferralRepository,
];

const services = [];

const entities = [UserEntity, AdminConfigEntity, TransactionEntity, UserReferralEntity];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => config.get('db'),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(entities),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [configDb],
    }),
  ],
  controllers: [],
  providers: [...repositories, ...services, SeedDatabase],
  exports: [...repositories, ...services],
})
export class DatabaseModule {}
