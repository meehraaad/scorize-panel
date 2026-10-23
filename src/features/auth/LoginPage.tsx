import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { IdentifyStep } from './components/IdentifyStep';
import { OtpStep } from './components/OtpStep';
import { PasswordStep } from './components/PasswordStep';
import { RegisterStep } from './components/RegisterStep';
import { ResetPasswordStep } from './components/ResetPasswordStep';
import { StepHeader } from './components/StepHeader';
import { useAuthFlow } from './useAuthFlow';

/** Login, sign-up and password reset in one page, for every role (panels are chosen after login). */
export default function LoginPage() {
  const { t } = useTranslation('auth');
  const [params, setParams] = useSearchParams();
  const { step, feedback, fieldErrors, pending, actions } = useAuthFlow({
    next: params.get('next'),
    resetToken: params.get('password_reset_token'),
  });

  const backToLogin = () => {
    // Drop the one-time reset token from the address bar, keep `next`.
    if (params.has('password_reset_token')) {
      params.delete('password_reset_token');
      setParams(params, { replace: true });
    }
    actions.restart();
  };

  return (
    <Card className="flex flex-col gap-6 p-6 sm:p-8">
      {feedback && <Notice tone={feedback.tone}>{t(feedback.message)}</Notice>}

      {step.name === 'identify' && (
        <IdentifyStep
          key={step.initial}
          initial={step.initial}
          pending={pending}
          onSubmit={actions.identify}
        />
      )}
      {step.name === 'otp' && (
        <OtpStep
          key={step.phone}
          phone={step.phone}
          sentAt={step.sentAt}
          purpose={step.purpose}
          pending={pending}
          onSubmit={actions.verifyOtp}
          onResend={actions.resendOtp}
          onChangePhone={() => actions.restart(step.phone)}
        />
      )}
      {step.name === 'password' && (
        <PasswordStep
          email={step.email}
          pending={pending}
          onSubmit={actions.password}
          onForgot={actions.forgotPassword}
          onChangeEmail={() => actions.restart(step.email)}
        />
      )}
      {step.name === 'register' && (
        <RegisterStep
          identifier={step.identifier}
          serverErrors={fieldErrors}
          pending={pending}
          onSubmit={actions.register}
          onBack={() => actions.restart(step.identifier.value)}
        />
      )}
      {step.name === 'resetPassword' && (
        <>
          <ResetPasswordStep pending={pending} onSubmit={actions.resetPassword} />
          <button
            type="button"
            onClick={backToLogin}
            className="min-h-11 self-start text-[15px] text-text-2 hover:text-text"
          >
            {t('resetSent.back')}
          </button>
        </>
      )}
      {step.name === 'resetSent' && (
        <>
          <StepHeader title={t('resetSent.title')}>
            {t('resetSent.body', { email: step.email })}
          </StepHeader>
          <button type="button" onClick={backToLogin} className={buttonClass('outline', 'w-full')}>
            {t('resetSent.back')}
          </button>
        </>
      )}
      {step.name === 'resetDone' && (
        <>
          <StepHeader title={t('reset.doneTitle')}>{t('reset.doneBody')}</StepHeader>
          <button type="button" onClick={backToLogin} className={buttonClass('primary', 'w-full')}>
            {t('reset.login')}
          </button>
        </>
      )}
    </Card>
  );
}
