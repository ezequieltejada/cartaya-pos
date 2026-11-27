import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular/standalone';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let toastController: jasmine.SpyObj<ToastController>;
  let toast: jasmine.SpyObj<HTMLIonToastElement>;

  beforeEach(() => {
    toast = jasmine.createSpyObj('Toast', ['present', 'dismiss', 'onDidDismiss']);
    toast.present.and.returnValue(Promise.resolve());
    toast.dismiss.and.returnValue(Promise.resolve(true));
    toast.onDidDismiss.and.returnValue(new Promise(() => undefined));
    toastController = jasmine.createSpyObj('ToastController', ['create']);
    toastController.create.and.returnValue(Promise.resolve(toast));

    TestBed.configureTestingModule({
      providers: [{ provide: ToastController, useValue: toastController }],
    });
    service = TestBed.inject(NotificationService);
  });

  it('should map kinds to Ionic colours, icons and durations, at the top by default', async () => {
    await service.success('ok');
    await service.error('boom');

    expect(toastController.create.calls.argsFor(0)[0]).toEqual(
      jasmine.objectContaining({ message: 'ok', color: 'success', duration: 2000, position: 'top' })
    );
    expect(toastController.create.calls.argsFor(1)[0]).toEqual(
      jasmine.objectContaining({ message: 'boom', color: 'danger', duration: 4000 })
    );
    expect(toast.present).toHaveBeenCalledTimes(2);
  });

  it('should add the action and dismiss buttons when requested', async () => {
    const handler = jasmine.createSpy('handler');
    await service.warning('careful', {
      action: { text: 'Retry', handler },
      dismissText: 'Close',
    });

    const options = toastController.create.calls.mostRecent().args[0] as { buttons?: { text: string; role?: string }[] };
    const buttons = options.buttons ?? [];
    expect(buttons.map((b) => b.text)).toEqual(['Retry', 'Close']);
    expect(buttons[1]?.role).toBe('cancel');
  });

  it('should dismiss a registered notification by id', async () => {
    await service.warning('offline', { id: 'net', duration: 0 });
    await service.dismiss('net');

    expect(toast.dismiss).toHaveBeenCalled();
  });

  it('should replace a visible notification that has the same id', async () => {
    await service.warning('offline', { id: 'net', duration: 0 });
    await service.warning('offline again', { id: 'net', duration: 0 });

    expect(toast.dismiss).toHaveBeenCalledTimes(1);
    expect(toastController.create).toHaveBeenCalledTimes(2);
  });

  it('should ignore dismiss for unknown ids', async () => {
    await service.dismiss('nope');

    expect(toast.dismiss).not.toHaveBeenCalled();
  });
});
