import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PosService } from '../../core/services/pos.service';
import { PosSelectionPage } from './pos-selection.page';

describe('PosSelectionPage', () => {
  let component: PosSelectionPage;
  let router: { navigate: jasmine.Spy };
  let authService: jasmine.SpyObj<AuthService>;
  let posService: jasmine.SpyObj<PosService>;

  beforeEach(() => {
    router = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };

    authService = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    authService.getCurrentUser.and.returnValue({ id: 'user-1' } as any);

    posService = jasmine.createSpyObj('PosService', [
      'fetchAvailablePos',
      'selectPos',
    ], {
      availablePos: () => [
        {
          id: 'pos-1',
          name: 'Main PoS',
          slug: 'main-pos',
          location: 'Front desk',
          settings: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
      isLoading: () => false,
    });
    posService.fetchAvailablePos.and.returnValue(of([]));
    posService.selectPos.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: authService },
        { provide: PosService, useValue: posService },
      ],
    });

    component = TestBed.runInInjectionContext(() => new PosSelectionPage());
  });

  it('redirects to login with replaceUrl when there is no current user', () => {
    authService.getCurrentUser.and.returnValue(null);

    component.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      replaceUrl: true,
    });
  });

  it('navigates to products with replaceUrl after selecting a PoS', async () => {
    component.selectedPosId = 'pos-1';

    await component.onContinue();

    expect(posService.selectPos).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: 'pos-1' })
    );
    expect(router.navigate).toHaveBeenCalledWith(['/products'], {
      replaceUrl: true,
    });
  });
});