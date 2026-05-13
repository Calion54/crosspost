import { Module, type OnModuleInit } from '@nestjs/common';
import { MongooseModule, InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Logger } from '@nestjs/common';
import { User, UserSchema, type UserDocument } from '../users/schemas/user.schema.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [AuthGuard],
  exports: [AuthGuard, MongooseModule],
})
export class AuthModule implements OnModuleInit {
  private readonly logger = new Logger(AuthModule.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async onModuleInit() {
    const count = await this.userModel.countDocuments().exec();
    if (count === 0) {
      await this.userModel.create({
        email: 'default@crosspost.local',
        password: 'not-used',
      });
      this.logger.log('Default user seeded');
    }
  }
}
