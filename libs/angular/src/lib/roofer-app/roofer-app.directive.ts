import {Directive, ElementRef, Input, NgZone, OnDestroy, Output} from '@angular/core';
import {Application, bootstrapApp, RooferLifecycleEvent} from '@roofer/core';
import {NEVER, Observable, of, Subject} from 'rxjs';
import {filter, finalize, startWith, switchMap, takeUntil, tap} from 'rxjs/operators';

@Directive({
  selector: '[roofer-app]:not(ng-container)',
})
export class RooferAppDirective implements OnDestroy {
  @Output()
  hook: Observable<RooferLifecycleEvent>;

  @Output()
  application: Observable<Application | null>;

  private destroy$ = new Subject<string>();
  private name$ = new Subject<string>();

  @Input('roofer-app')
  set name(appName: string) {
    this.ngZone.runOutsideAngular(() => this.name$.next(appName));
  }

  constructor(private elementRef: ElementRef, private ngZone: NgZone) {
    this.application = this.name$.pipe(
      tap(() => NgZone.assertNotInAngularZone()),
      switchMap(name =>
        name
          ? bootstrapApp(name, this.elementRef.nativeElement).pipe(
              switchMap(app =>
                NEVER.pipe(
                  startWith(app),
                  finalize(() => {
                    app.destroy();
                  }),
                ),
              ),
            )
          : of(null),
      ),
      takeUntil(this.destroy$),
    );

    this.hook = this.application.pipe(
      filter((app => !!app) as (app: unknown) => app is Application),
      switchMap(
        app =>
          new Observable<RooferLifecycleEvent>(subscriber =>
            app.onHook(event => subscriber.next(event)),
          ),
      ),
    );

    this.application.subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}