import { HttpErrorResponse } from '@angular/common/http'
import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup } from '@angular/forms'
import { MatDialog, MatDialogRef, MatSnackBar } from '@angular/material'
import { Router } from '@angular/router'
import { AuthenticationService, EmailAccountsService, UsersService } from 'ducky-api-client-angular'
import { MatProgressButtonOptions } from 'mat-progress-buttons'
import { DialogComponent } from 'src/app/shared/components/dialog/dialog.component'
import { DialogConfig } from 'src/app/shared/components/dialog/dialog.interfaces'
import { ErrorSnackbarService } from 'src/app/shared/components/error-snackbar/error-snackbar.service'
import { formatBytes } from 'src/app/shared/functions/formatBytes.function'
import { IsAsciiValidator } from 'src/app/shared/validators/ascii-validator.directive'
import { notContainsValidator } from 'src/app/shared/validators/not-contains-validator.directive'

import { ProfileService } from './profile.service'

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  public constructor(
    private usersService: UsersService,
    private profileService: ProfileService,
    private authenticationService: AuthenticationService,
    private emailAccountsService: EmailAccountsService,
    private snackBar: MatSnackBar,
    private errorSnackbarService: ErrorSnackbarService,
    private router: Router,
    public dialog: MatDialog,
  ) {}
  public usage = {
    bytes: 0,
    formatted: '0 Bytes',
  }

  public loginDetailsForm: FormGroup = new FormGroup({
    username: new FormControl(this.profileService.username, [IsAsciiValidator(), notContainsValidator(' ')]),
    password: new FormControl(null),
  })

  public loginDetailsButtonConfig: MatProgressButtonOptions = {
    active: false,
    text: 'CHANGE',
    disabled: true,
    raised: true,
    buttonColor: 'primary',
    spinnerColor: 'accent',
    spinnerSize: 18,
    mode: 'indeterminate',
  }

  public ngOnInit(): void {
    this.calculateStorage()
    this.profileService.userInfoSubscription.add(() => {
      // Only set username after the userinfo request has finished
      this.loginDetailsForm.controls['username'].setValue(this.profileService.username)
    })
    this.loginDetailsForm.valueChanges.subscribe((): void => {
      this.loginDetailsButtonConfig.disabled = this.loginDetailsForm.invalid
    })
  }

  public calculateStorage(): void {
    this.usage.bytes = 0
    this.emailAccountsService.getAccounts().subscribe(
      (accounts): void => {
        for (const account of accounts) {
          this.usage.bytes += account.quota.used
        }
        this.usage.formatted = formatBytes(this.usage.bytes)
      },
      error => {
        this.errorSnackbarService.open(error)
      },
    )
  }

  public changeLoginDetails(): void {
    if (this.loginDetailsForm.valid) {
      this.loginDetailsButtonConfig.active = true
      this.usersService
        .updateMe({
          username: this.loginDetailsForm.value.username,
          password: this.loginDetailsForm.value.password,
        })
        .subscribe(
          (): void => {
            this.loginDetailsButtonConfig.active = false
            this.snackBar.open(`Username/Password successfully updated`, undefined, {
              panelClass: 'success-snackbar',
            })
            this.profileService.getUserInfo()
          },
          (error): void => {
            this.loginDetailsButtonConfig.active = false
            this.errorSnackbarService.open(error)
          },
        )
    }
  }

  public logout(): void {
    localStorage.removeItem('access_token')
    delete this.authenticationService.configuration.accessToken
    this.snackBar.open('Logged out successfully', undefined, {
      panelClass: 'success-snackbar',
    })
    this.router.navigateByUrl('/login')
  }

  public logoutAllDialog(): void {
    const dialogConfig: DialogConfig = {
      data: {
        title: 'Log out from all devices',
        text: 'Are you sure? This will also log you out on this device.',
        buttons: [
          {
            options: {
              active: false,
              text: 'NO',
            },
          },
          {
            options: {
              active: false,
              text: 'YES',
              buttonColor: 'warn',
              spinnerSize: 18,
              mode: 'indeterminate',
            },
            callback: (dialogRef: MatDialogRef<DialogComponent>): void => {
              dialogRef.disableClose = true
              dialogConfig.data.buttons[0].options.disabled = true
              dialogConfig.data.buttons[1].options.active = true

              this.authenticationService.revokeAllAccessTokens().subscribe(
                (): void => {
                  dialogRef.close()
                  this.logout()
                },
                (error: HttpErrorResponse): void => {
                  dialogRef.disableClose = false
                  dialogConfig.data.buttons[0].options.disabled = false
                  dialogConfig.data.buttons[1].options.active = false
                  this.errorSnackbarService.open(error)
                },
              )
            },
          },
        ],
      },
    }
    this.dialog.open(DialogComponent, dialogConfig)
  }
}
