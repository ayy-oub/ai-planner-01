import { QueueService, QueueName } from '../services/queue.service';
import { logger } from '../utils/logger';

export function initQueues(queueService: QueueService) {
    logger.info('Initializing queues...');

    Object.values(QueueName).forEach(queueName => {
        queueService.createQueue(queueName);
        logger.info(`Queue initialized: ${queueName}`);
    });

    logger.info('All queues initialized.');
}
