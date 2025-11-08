import { Injectable, inject } from '@angular/core';
import { MenuController } from '@ionic/angular';

/**
 * MenuService
 * Provides a typed, centralized wrapper around Ionic menus.
 * Follows Ionic best practices by using the menu element's methods directly.
 *
 * Usage:
 * - constructor(private menuService = inject(MenuService))
 * - await this.menuService.openMenu('menu-id')
 * - await this.menuService.closeMenu('menu-id')
 * - await this.menuService.toggleMenu('menu-id')
 * - const isOpen = await this.menuService.isOpen('menu-id')
 */
@Injectable({
  providedIn: 'root',
})
export class MenuService {
  private menuController = inject(MenuController);

  /**
   * Gets a menu element by its ID from the DOM
   * @param menuId The unique identifier of the menu
   * @returns The ion-menu element or null if not found
   */
  private getMenuElement(menuId: string): HTMLIonMenuElement | null {
    return document.querySelector(`ion-menu[menuId="${menuId}"]`) as HTMLIonMenuElement | null;
  }

  /**
   * Opens a menu by its ID
   * @param menuId The unique identifier of the menu to open
   * @returns Promise resolving to true if the menu is successfully opened, false otherwise
   */
  async openMenu(menuId: string): Promise<boolean> {
    try {
      const menu = this.getMenuElement(menuId);
      if (!menu) {
        console.warn(`Menu with ID "${menuId}" not found`);
        return false;
      }
      await menu.open();
      return true;
    } catch (error) {
      console.error(`Failed to open menu "${menuId}":`, error);
      return false;
    }
  }

  /**
   * Closes a menu by its ID
   * @param menuId The unique identifier of the menu to close
   * @returns Promise resolving to true if the menu is successfully closed, false otherwise
   */
  async closeMenu(menuId: string): Promise<boolean> {
    try {
      const menu = this.getMenuElement(menuId);
      if (!menu) {
        console.warn(`Menu with ID "${menuId}" not found`);
        return false;
      }
      await menu.close();
      return true;
    } catch (error) {
      console.error(`Failed to close menu "${menuId}":`, error);
      return false;
    }
  }

  /**
   * Toggles the open/closed state of a menu by its ID
   * @param menuId The unique identifier of the menu to toggle
   * @returns Promise resolving to true if the menu is now open, false if now closed
   */
  async toggleMenu(menuId: string): Promise<boolean> {
    try {
      const menu = this.getMenuElement(menuId);
      if (!menu) {
        console.warn(`Menu with ID "${menuId}" not found`);
        return false;
      }
      return await menu.toggle();
    } catch (error) {
      console.error(`Failed to toggle menu "${menuId}":`, error);
      return false;
    }
  }

  /**
   * Checks if a menu is currently open
   * @param menuId The unique identifier of the menu to check
   * @returns Promise resolving to true if the menu is open, false otherwise
   */
  async isOpen(menuId: string): Promise<boolean> {
    try {
      const menu = this.getMenuElement(menuId);
      if (!menu) {
        console.warn(`Menu with ID "${menuId}" not found`);
        return false;
      }
      return await menu.isOpen();
    } catch (error) {
      console.error(`Failed to check if menu "${menuId}" is open:`, error);
      return false;
    }
  }
}
