/**
 * Dependency Injection Container
 * Simple DI container for managing service dependencies
 */

type Constructor<T = unknown> = new (...args: any[]) => T;
type Factory<T = unknown> = () => T;

interface ServiceDescriptor {
  implementation: Constructor | Factory;
  singleton?: boolean;
  dependencies?: string[];
}

export class Container {
  private services = new Map<string, ServiceDescriptor>();
  private instances = new Map<string, unknown>();

  /**
   * Register a service in the container
   */
  register<T>(
    token: string,
    implementation: Constructor<T> | Factory<T>,
    options?: { singleton?: boolean; dependencies?: string[] }
  ): void {
    this.services.set(token, {
      implementation,
      singleton: options?.singleton ?? true,
      dependencies: options?.dependencies ?? [],
    });
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: string): T {
    // Check for existing singleton instance
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(`Service ${token} not registered in container`);
    }

    // Resolve dependencies
    const dependencies = (descriptor.dependencies || []).map(dep => this.resolve(dep));

    // Create instance
    let instance: T;
    if (typeof descriptor.implementation === 'function' && descriptor.implementation.prototype) {
      // Constructor
      instance = new (descriptor.implementation as Constructor<T>)(...dependencies);
    } else {
      // Factory function
      instance = (descriptor.implementation as Factory<T>)();
    }

    // Store singleton
    if (descriptor.singleton) {
      this.instances.set(token, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   */
  isRegistered(token: string): boolean {
    return this.services.has(token);
  }

  /**
   * Clear all registered services and instances
   */
  clear(): void {
    this.services.clear();
    this.instances.clear();
  }
}

export const container = new Container();
