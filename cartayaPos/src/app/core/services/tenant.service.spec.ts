import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ImageCacheService } from './image-cache.service';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: jasmine.createSpyObj('StorageService', ['get', 'set', 'remove']) },
        { provide: ImageCacheService, useValue: jasmine.createSpyObj('ImageCacheService', ['getCachedImage']) },
      ],
    });
    service = TestBed.inject(TenantService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
