import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Pos } from '../models/pos.model';
import { AuthService } from './auth.service';
import { PosService } from './pos.service';
import { StorageService } from './storage.service';

describe('PosService', () => {
  let service: PosService;
  let httpMock: HttpTestingController;
  let storageService: jasmine.SpyObj<StorageService>;
  let authService: jasmine.SpyObj<AuthService>;

  const mockPosList: Pos[] = [
    {
      id: 'pos-1',
      name: 'Main Store',
      slug: 'main-store',
      location: '123 Main St',
      settings: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'pos-2',
      name: 'Downtown Location',
      slug: 'downtown',
      location: '456 Oak Ave',
      settings: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    const storageSpy = jasmine.createSpyObj('StorageService', ['set', 'get', 'remove', 'clear']);
    const authSpy = jasmine.createSpyObj('AuthService', [
      'login',
      'logout',
      'checkSession',
      'clearSession',
      'getCurrentUser',
      'getIsAuthenticated',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PosService,
        { provide: StorageService, useValue: storageSpy },
        { provide: AuthService, useValue: authSpy },
      ],
    });

    service = TestBed.inject(PosService);
    httpMock = TestBed.inject(HttpTestingController);
    storageService = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('fetchAvailablePos', () => {
    it('should fetch PoS locations and update signal', (done) => {
      const tenantId = 'tenant-123';

      service.fetchAvailablePos(tenantId).subscribe((posList) => {
        expect(posList).toEqual(mockPosList);
        expect(service.availablePos()).toEqual(mockPosList);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/tenants/${tenantId}/pos`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: mockPosList });
    });

    it('should set isLoading during fetch', (done) => {
      const tenantId = 'tenant-123';

      expect(service.isLoading()).toBe(false);

      const subscription = service.fetchAvailablePos(tenantId).subscribe(() => {
        expect(service.isLoading()).toBe(false);
        subscription.unsubscribe();
        done();
      });

      expect(service.isLoading()).toBe(true);

      const req = httpMock.expectOne(`${environment.apiUrl}/api/tenants/${tenantId}/pos`);
      req.flush({ data: mockPosList });
    });

    it('should handle fetch errors gracefully', (done) => {
      const tenantId = 'tenant-123';

      service.fetchAvailablePos(tenantId).subscribe((posList) => {
        expect(posList).toEqual([]);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/tenants/${tenantId}/pos`);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('selectPos', () => {
    it('should set selectedPos signal and persist to storage', async () => {
      storageService.set.and.returnValue(Promise.resolve());

      await service.selectPos(mockPosList[0]);

      expect(service.selectedPos()).toEqual(mockPosList[0]);
      expect(storageService.set).toHaveBeenCalledWith('selectedPos', mockPosList[0]);
    });

    it('should update selectedPos when different PoS is selected', async () => {
      storageService.set.and.returnValue(Promise.resolve());

      await service.selectPos(mockPosList[0]);
      expect(service.selectedPos()).toEqual(mockPosList[0]);

      await service.selectPos(mockPosList[1]);
      expect(service.selectedPos()).toEqual(mockPosList[1]);
      expect(storageService.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearSelection', () => {
    it('should clear selectedPos and remove from storage', async () => {
      service.selectedPos.set(mockPosList[0]);
      storageService.remove.and.returnValue(Promise.resolve());

      await service.clearSelection();

      expect(service.selectedPos()).toBeNull();
      expect(storageService.remove).toHaveBeenCalledWith('selectedPos');
    });
  });

  describe('getSelectedPos', () => {
    it('should return currently selected PoS', () => {
      service.selectedPos.set(mockPosList[0]);
      expect(service.getSelectedPos()).toEqual(mockPosList[0]);
    });

    it('should return null if no PoS selected', () => {
      service.selectedPos.set(null);
      expect(service.getSelectedPos()).toBeNull();
    });
  });

  describe('availablePos signal', () => {
    it('should start empty', () => {
      expect(service.availablePos()).toEqual([]);
    });

    it('should update when PoS are fetched', (done) => {
      const tenantId = 'tenant-123';

      service.fetchAvailablePos(tenantId).subscribe(() => {
        expect(service.availablePos()).toEqual(mockPosList);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/tenants/${tenantId}/pos`);
      req.flush({ data: mockPosList });
    });
  });
});
