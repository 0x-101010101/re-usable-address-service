import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OneClickService } from './one-click.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 30000,
    }),
  ],
  providers: [OneClickService],
  exports: [OneClickService],
})
export class OneClickModule {}
