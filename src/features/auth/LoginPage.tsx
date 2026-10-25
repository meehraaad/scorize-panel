import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Notice } from '@/components/ui/Notice';
import { IdentifyStep } from './components/IdentifyStep';
import { OtpStep } from './components/OtpStep';
import { PasswordStep } from './components/PasswordStep';
import { RegisterStep } from './components/RegisterStep';
import { ResetPasswordStep } from './components/ResetPasswordStep';
import { StepHeader } from './components/StepHeader';
import { WelcomeStep } from './components/WelcomeStep';
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

  // A wrong or expired code is shown under the code boxes (design); everything else on top.
  const otpError = step.name === 'otp' && feedback?.tone === 'error' ? feedback : null;

  return (
    // Keyed by step: each new step rises into place.
    <div key={step.name} className="flex animate-rise flex-col gap-6">
      {feedback && !otpError && (
        <Notice tone={feedback.tone}>{t(feedback.message, feedback.values ?? {})}</Notice>
      )}

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
          error={otpError ? t(otpError.message, otpError.values ?? {}) : undefined}
          onSubmit={actions.verifyOtp}
          onResend={actions.resendOtp}
          onChangePhone={() => actions.restart(step.phone)}
          onEdit={actions.clearFeedback}
        />
      )}
      {step.name === 'password' && (
        <PasswordStep
          email={step.email}
          pending={pending}
          onSubmit={actions.password}
          onForgot={actions.forgotPassword}
          onChangeEmail={() => actions.restart(step.email)}
          onUseSms={actions.useSms}
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
      {step.name === 'welcome' && (
        <WelcomeStep firstName={step.firstName} pending={pending} onContinue={actions.enterPanel} />
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
          <button
            type="button"
            onClick={backToLogin}
            className={buttonClass('outline', 'w-full', 'lg')}
          >
            {t('resetSent.back')}
          </button>
        </>
      )}
      {step.name === 'resetDone' && (
        <>
          <StepHeader title={t('reset.doneTitle')}>{t('reset.doneBody')}</StepHeader>
          <button
            type="button"
            onClick={backToLogin}
            className={buttonClass('primary', 'w-full', 'lg')}
          >
            {t('reset.login')}
          </button>
        </>
      )}
    </div>
  );
}
