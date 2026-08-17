import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { Pos } from '../../core/models/pos.model';
import { AuthService } from '../../core/services/auth.service';
import { PosService } from '../../core/services/pos.service';
import { PosSelectionPage } from './pos-selection.page';

describe('PosSelectionPage', () => {
  let component: PosSelectionPage;
  let router: { navigate: jasmine.Spy };
  let authService: jasmine.SpyObj<AuthService>;
  let posService: jasmine.SpyObj<PosService>;

  const mainPos: Pos = {
    id: 'pos-1',
    name: 'Main PoS',
    slug: 'main-pos',
    location: 'Front desk',
    settings: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  const secondPos: Pos = {
    id: 'pos-2',
    name: 'Counter PoS',
    slug: 'counter-pos',
    location: 'Counter',
    settings: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    router = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };

    authService = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    authService.getCurrentUser.and.returnValue({ id: 'user-1' } as any);

    posService = jasmine.createSpyObj('PosService', [
      'fetchAvailablePos',
      'selectPos',
      'restoreSelectedPos',
      'getSelectedPos',
    ], {
      availablePos: () => [mainPos, secondPos],
      isLoading: () => false,
    });
    posService.fetchAvailablePos.and.returnValue(of([]));
    posService.selectPos.and.resolveTo();
    posService.restoreSelectedPos.and.resolveTo();
    posService.getSelectedPos.and.returnValue(null);

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

  it('defaults the selection to the first available PoS when nothing was saved', async () => {
    await component.ngOnInit();

    expect(component.selectedPosId).toBe('pos-1');
  });

  it('preselects the saved PoS from storage when it is still available', async () => {
    posService.getSelectedPos.and.returnValue(secondPos);

    await component.ngOnInit();

    expect(component.selectedPosId).toBe('pos-2');
  });

  it('defaults to the first available PoS when the saved PoS is no longer available', async () => {
    posService.getSelectedPos.and.returnValue({ ...mainPos, id: 'pos-99' });

    await component.ngOnInit();

    expect(component.selectedPosId).toBe('pos-1');
  });
});