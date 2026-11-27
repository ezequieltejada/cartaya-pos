import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NetworkService } from '../../../core/services/network.service';
import { NotificationService } from '../../../core/services/notification.service';
import { NetworkStatusComponent } from './network-status.component';

describe('NetworkStatusComponent', () => {
  let online: ReturnType<typeof signal<boolean>>;
  let notifications: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    online = signal(true);
    notifications = jasmine.createSpyObj('NotificationService', ['warning', 'dismiss']);
    notifications.warning.and.returnValue(Promise.resolve());
    notifications.dismiss.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [NetworkStatusComponent, TranslateModule.forRoot()],
      providers: [
        { provide: NetworkService, useValue: { isOnline: online } },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(NetworkStatusComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show a persistent warning notification when offline', () => {
    online.set(false);
    const fixture = TestBed.createComponent(NetworkStatusComponent);
    fixture.detectChanges();

    expect(notifications.warning).toHaveBeenCalledWith(
      jasmine.any(String),
      jasmine.objectContaining({ id: 'network-offline', duration: 0 })
    );
  });

  it('should dismiss the notification when the connection is back', () => {
    online.set(false);
    const fixture = TestBed.createComponent(NetworkStatusComponent);
    fixture.detectChanges();

    online.set(true);
    fixture.detectChanges();

    expect(notifications.dismiss).toHaveBeenCalledWith('network-offline');
  });
});
