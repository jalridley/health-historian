'use client';

import { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm, useWatch } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { supabase } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignUpFormValues = {
  email: string;
  password: string;
  confirmPassword: string;
};

export default function CreateAccountPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });
  const passwordValue = useWatch({
    control,
    name: 'password',
    defaultValue: '',
  });
  const confirmPasswordValue = useWatch({
    control,
    name: 'confirmPassword',
    defaultValue: '',
  });

  const handleSignUp: SubmitHandler<SignUpFormValues> = async (values) => {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setMessage('Account created successfully. Redirecting to log in...');
    setLoading(false);
    router.push('/');
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Use your email and a password to create an account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(handleSignUp)}
            noValidate
          >
            <Field data-invalid={!!errors.email}>
              <FieldLabel>Email</FieldLabel>
              <FieldContent>
                <Input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  {...register('email', {
                    required: 'Email is required.',
                    pattern: {
                      value: EMAIL_REGEX,
                      message: 'Enter a valid email address.',
                    },
                  })}
                  aria-invalid={!!errors.email}
                />
              </FieldContent>
              <FieldError errors={[errors.email]} />
            </Field>

            <Field data-invalid={!!errors.password}>
              <FieldLabel>Password</FieldLabel>
              <FieldContent>
                <div className="flex items-center gap-2">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    autoComplete="new-password"
                    {...register('password', {
                      required: 'Password is required.',
                      minLength: {
                        value: 8,
                        message: 'Your password must be 8 characters long.',
                      },
                    })}
                    aria-invalid={!!errors.password}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    view
                  </Button>
                </div>
              </FieldContent>
              {passwordValue.length > 0 &&
              passwordValue.length < 8 &&
              !errors.password ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Your password must be 8 characters long.
                </p>
              ) : null}
              <FieldError errors={[errors.password]} />
            </Field>

            <Field data-invalid={!!errors.confirmPassword}>
              <FieldLabel>Confirm Password</FieldLabel>
              <FieldContent>
                <div className="flex items-center gap-2">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    autoComplete="new-password"
                    {...register('confirmPassword', {
                      required: 'Please confirm your password.',
                      validate: (value) =>
                        value === getValues('password') ||
                        'Passwords do not match.',
                    })}
                    aria-invalid={!!errors.confirmPassword}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    view
                  </Button>
                </div>
              </FieldContent>
              {confirmPasswordValue.length > 0 &&
              confirmPasswordValue === passwordValue &&
              !errors.confirmPassword ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Passwords match.
                </p>
              ) : null}
              <FieldError errors={[errors.confirmPassword]} />
            </Field>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                Create account
              </Button>
            </div>
          </form>

          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Already have an account?{' '}
            <Link className="underline underline-offset-4" href="/">
              Log in
            </Link>
          </p>

          {message ? (
            <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
