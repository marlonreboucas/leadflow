import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@leadflow/shared';
import { CreateTaskDto, UpdateTaskDto, ListTasksQueryDto } from './dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get()
  list(
    @CurrentUser('companyId') companyId: string,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.list(companyId, query);
  }

  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  @Get(':id')
  get(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.tasksService.get(companyId, id);
  }

  @RequirePermissions(PERMISSIONS.LEADS_CREATE)
  @Post()
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() body: CreateTaskDto,
  ) {
    return this.tasksService.create(companyId, body);
  }

  @RequirePermissions(PERMISSIONS.LEADS_UPDATE)
  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: UpdateTaskDto,
  ) {
    return this.tasksService.update(companyId, id, body);
  }

  @RequirePermissions(PERMISSIONS.LEADS_DELETE)
  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.tasksService.remove(companyId, id);
  }
}
