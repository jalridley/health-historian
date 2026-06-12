'use client';

import { useEffect, useState } from 'react';
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
import { clearStoredProfileSelection, ensureSelfProfile } from '@/lib/api';
import {
  DUPLICATE_SIGNUP_MESSAGE,
  isDuplicateSignup,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignUpFormValues = {
  firstName: string;
  lastName: string;
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
      firstName: '',
      lastName: '',
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

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/profiles');
      }
    });
  }, [router]);

  const handleSignUp: SubmitHandler<SignUpFormValues> = async (values) => {
    setLoading(true);
    setMessage(null);

    const email = values.email.trim();
    const password = values.password;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
        },
      },
    });

    if (isDuplicateSignup(error, data.user, data.session)) {
      setMessage(DUPLICATE_SIGNUP_MESSAGE);
      setLoading(false);
      return;
    }

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    let session = data.session;
    if (!session) {
      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) {
        setMessage(
          'Account created. Check your email to confirm, then log in.',
        );
        setLoading(false);
        return;
      }
      session = signIn.data.session;
    }

    if (!session) {
      setMessage('Account created. Check your email to confirm, then log in.');
      setLoading(false);
      return;
    }

    clearStoredProfileSelection();

    try {
      await ensureSelfProfile(session);
    } catch (bootstrapError) {
      const detail =
        bootstrapError instanceof Error
          ? bootstrapError.message
          : 'Could not create your profile.';
      setMessage(detail);
      setLoading(false);
      return;
    }

    router.replace('/profiles');
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Use your name, email, and a password to create an account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={handleSubmit(handleSignUp)}
            noValidate
          >
            <Field data-invalid={!!errors.firstName}>
              <FieldLabel>First name</FieldLabel>
              <FieldContent>
                <Input
                  placeholder="First name"
                  autoComplete="given-name"
                  {...register('firstName', {
                    required: 'First name is required.',
                    maxLength: {
                      value: 64,
                      message: 'First name is too long.',
                    },
                  })}
                  aria-invalid={!!errors.firstName}
                />
              </FieldContent>
              <FieldError errors={[errors.firstName]} />
            </Field>

            <Field data-invalid={!!errors.lastName}>
              <FieldLabel>Last name</FieldLabel>
              <FieldContent>
                <Input
                  placeholder="Last name"
                  autoComplete="family-name"
                  {...register('lastName', {
                    required: 'Last name is required.',
                    maxLength: {
                      value: 64,
                      message: 'Last name is too long.',
                    },
                  })}
                  aria-invalid={!!errors.lastName}
                />
              </FieldContent>
              <FieldError errors={[errors.lastName]} />
            </Field>

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
