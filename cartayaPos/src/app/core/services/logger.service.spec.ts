import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ErrorReportingService } from './error-reporting.service';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let reporting: jasmine.SpyObj<ErrorReportingService>;
  let logger: LoggerService;
  const originalProduction = environment.production;

  beforeEach(() => {
    reporting = jasmine.createSpyObj('ErrorReportingService', ['captureLog']);
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorReportingService, useValue: reporting }],
    });
    logger = TestBed.inject(LoggerService);
    spyOn(console, 'debug');
    spyOn(console, 'warn');
    spyOn(console, 'error');
  });

  afterEach(() => {
    (environment as { production: boolean }).production = originalProduction;
  });

  describe('in development', () => {
    beforeEach(() => {
      (environment as { production: boolean }).production = false;
    });

    it('should log traces to the console and Rustrak', () => {
      logger.scope('printer').trace('connect attempt', { address: 'AA:BB' });

      expect(console.debug).toHaveBeenCalledWith('[printer]', 'connect attempt', { address: 'AA:BB' });
      expect(reporting.captureLog).toHaveBeenCalledWith('debug', 'printer', 'connect attempt', { address: 'AA:BB' });
    });

    it('should log warnings to the console and Rustrak', () => {
      logger.scope('printer').warn('probe failed', 'boom');

      expect(console.warn).toHaveBeenCalledWith('[printer]', 'probe failed', 'boom');
      expect(reporting.captureLog).toHaveBeenCalledWith('warn', 'printer', 'probe failed', { detail: 'boom' });
    });
  });

  describe('in production', () => {
    beforeEach(() => {
      (environment as { production: boolean }).production = true;
    });

    it('should stay silent for traces and warnings', () => {
      const log = logger.scope('printer');
      log.trace('connect attempt');
      log.warn('probe failed');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(reporting.captureLog).not.toHaveBeenCalled();
    });
  });

  it('should always log errors through console.error (an issue in Rustrak)', () => {
    (environment as { production: boolean }).production = true;
    const failure = new Error('boom');
    logger.scope('printer').error('connect failed', failure, { address: 'AA:BB' });

    expect(console.error).toHaveBeenCalledWith('[printer]', 'connect failed', failure, { address: 'AA:BB' });
    expect(reporting.captureLog).not.toHaveBeenCalled();
  });

  it('should also add errors to the Logs timeline in development', () => {
    (environment as { production: boolean }).production = false;
    const failure = new Error('boom');
    logger.scope('printer').error('connect failed', failure);

    expect(reporting.captureLog).toHaveBeenCalledWith('error', 'printer', 'connect failed', { error: failure });
  });
});
