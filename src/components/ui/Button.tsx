import type { ComponentProps } from 'react';
import { buttonClass, type ButtonSize, type ButtonVariant, type ButtonShape } from './buttonStyles';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
}

export function Button({
  variant = 'primary',
  size = 'md',
  shape = 'pill',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className, size, shape)} {...props} />;
}
