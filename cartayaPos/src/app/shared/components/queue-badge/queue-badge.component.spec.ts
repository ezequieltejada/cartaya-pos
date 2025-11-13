import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { OrderQueueService } from '../../../core/services/order-queue.service';
import { QueueBadgeComponent } from './queue-badge.component';

describe('QueueBadgeComponent', () => {
  let component: QueueBadgeComponent;
  let fixture: ComponentFixture<QueueBadgeComponent>;
  let queueService: jasmine.SpyObj<OrderQueueService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const queueServiceSpy = jasmine.createSpyObj('OrderQueueService', [], {
      totalQueueSize: jasmine.createSpy().and.returnValue(0),
      pendingCount: jasmine.createSpy().and.returnValue(0),
      outOfSyncCount: jasmine.createSpy().and.returnValue(0),
    });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [QueueBadgeComponent],
      providers: [
        { provide: OrderQueueService, useValue: queueServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QueueBadgeComponent);
    component = fixture.componentInstance;
    queueService = TestBed.inject(OrderQueueService) as jasmine.SpyObj<OrderQueueService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not display badge when queue is empty', () => {
    Object.defineProperty(queueService, 'totalQueueSize', {
      get: () => () => 0,
    });
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('ion-badge');
    expect(badge).toBeFalsy();
  });

  it('should display badge with count when queue has items', () => {
    Object.defineProperty(queueService, 'totalQueueSize', {
      get: () => () => 3,
    });
    Object.defineProperty(queueService, 'pendingCount', {
      get: () => () => 3,
    });
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('ion-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('3');
  });

  it('should navigate to queue page when clicked', () => {
    Object.defineProperty(queueService, 'totalQueueSize', {
      get: () => () => 1,
    });
    fixture.detectChanges();
    component.navigateToQueue();
    expect(router.navigate).toHaveBeenCalledWith(['/order-queue']);
  });

  it('should show alert icon when out-of-sync orders exist', () => {
    Object.defineProperty(queueService, 'outOfSyncCount', {
      get: () => () => 1,
    });
    const icon = component.getIcon();
    expect(icon).toBe(component.alertCircleOutline);
  });

  it('should show upload icon when no out-of-sync orders', () => {
    Object.defineProperty(queueService, 'outOfSyncCount', {
      get: () => () => 0,
    });
    const icon = component.getIcon();
    expect(icon).toBe(component.cloudUploadOutline);
  });
});
