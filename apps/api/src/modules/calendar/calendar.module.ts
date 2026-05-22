import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { GoogleCalendarModule } from '../../integrations/google-calendar/google-calendar.module';

@Module({
  imports: [GoogleCalendarModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
