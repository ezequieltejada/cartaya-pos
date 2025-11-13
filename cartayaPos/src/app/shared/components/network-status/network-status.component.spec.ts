import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NetworkService } from '../../../core/services/network.service';
import { NetworkStatusComponent } from './network-status.component';

describe('NetworkStatusComponent', () => {
  let component: NetworkStatusComponent;
  let fixture: ComponentFixture<NetworkStatusComponent>;
  let networkService: jasmine.SpyObj<NetworkService>;

  beforeEach(async () => {
    const networkServiceSpy = jasmine.createSpyObj('NetworkService', [], {
      isOnline: jasmine.createSpy().and.returnValue(true),
    });

    await TestBed.configureTestingModule({
      imports: [NetworkStatusComponent],
      providers: [
        { provide: NetworkService, useValue: networkServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NetworkStatusComponent);
    component = fixture.componentInstance;
    networkService = TestBed.inject(NetworkService) as jasmine.SpyObj<NetworkService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display offline banner when isOnline is false', () => {
    Object.defineProperty(networkService, 'isOnline', {
      get: () => () => false,
    });
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.network-banner');
    expect(banner).toBeTruthy();
  });

  it('should not display banner when isOnline is true', () => {
    Object.defineProperty(networkService, 'isOnline', {
      get: () => () => true,
    });
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.network-banner');
    expect(banner).toBeFalsy();
  });
});
