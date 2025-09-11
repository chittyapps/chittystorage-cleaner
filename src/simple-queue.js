// Simple queue implementation to replace better-queue
class SimpleQueue {
    constructor(processor, options = {}) {
        this.processor = processor;
        this.options = {
            concurrent: options.concurrent || 1,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 5000,
            ...options
        };
        
        this.queue = [];
        this.running = 0;
        this.paused = false;
    }
    
    push(task, callback) {
        this.queue.push({ task, callback, retries: 0 });
        this.process();
    }
    
    async process() {
        if (this.paused || this.running >= this.options.concurrent) {
            return;
        }
        
        const item = this.queue.shift();
        if (!item) {
            return;
        }
        
        this.running++;
        
        try {
            const result = await this.processor(item.task, (err, res) => {
                if (err && item.retries < this.options.maxRetries) {
                    item.retries++;
                    setTimeout(() => {
                        this.queue.unshift(item);
                        this.process();
                    }, this.options.retryDelay);
                } else {
                    if (item.callback) {
                        item.callback(err, res);
                    }
                }
            });
        } catch (error) {
            if (item.retries < this.options.maxRetries) {
                item.retries++;
                setTimeout(() => {
                    this.queue.unshift(item);
                    this.process();
                }, this.options.retryDelay);
            } else if (item.callback) {
                item.callback(error);
            }
        } finally {
            this.running--;
            this.process();
        }
    }
    
    pause() {
        this.paused = true;
    }
    
    resume() {
        this.paused = false;
        this.process();
    }
    
    get length() {
        return this.queue.length;
    }
}

module.exports = SimpleQueue;