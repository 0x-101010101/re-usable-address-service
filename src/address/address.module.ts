import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { AddressEntity } from './address.entity';
import { OneClickModule } from '../one-click/one-click.module';

@Module({
  imports: [TypeOrmModule.forFeature([AddressEntity]), OneClickModule],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class AddressModule {}
