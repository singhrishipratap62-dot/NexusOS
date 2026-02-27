import { Controller, Post } from '@nestjs/common';
import { DemoService } from './demo.service';
import { Public } from '../auth/public.decorator';

@Controller('demo')
export class DemoController {
    constructor(private readonly demoService: DemoService) { }

    @Public()
    @Post('seed')
    async seedDemoTenant() {
        return this.demoService.createDemoTenant();
    }
}
