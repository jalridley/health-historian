'use client';

import { useEffect, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
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
import { ensureSelfProfile, selfProfileFromList } from '@/lib/api';
import { accountNameFromUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthFormValues = {
  email: string;
  password: string;
};

export default function HomePage() {
  const [accountName, setAccountName] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loadSignedInState = async (
    session: NonNullable<
      Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']
    >,
  ) => {
    setAccountName(accountNameFromUser(session.user));
    try {
      const profiles = await ensureSelfProfile(session);
      const selfProfile = selfProfileFromList(profiles);
      setProfileDisplayName(selfProfile?.display_name ?? null);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Could not load profile.';
      setMessage(detail);
      setProfileDisplayName(null);
    }
  };

  const clearSignedInState = () => {
    setAccountName(null);
    setProfileDisplayName(null);
  };

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data.session?.user) {
        await loadSignedInState(data.session);
      } else {
        clearSignedInState();
      }
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void loadSignedInState(session);
      } else {
        clearSignedInState();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn: SubmitHandler<AuthFormValues> = async (values) => {
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      await loadSignedInState(data.session);
    }

    setMessage('Log in successful.');
    setLoading(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signOut();

    setMessage(error ? error.message : 'Log out successful.');
    setLoading(false);
  };

  return (
    <div className="p-10">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">HealthHistorian</h1>
        {accountName ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              {accountName}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              disabled={loading}
            >
              Log out
            </Button>
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-4">
        {accountName ? (
          <Card>
            <CardHeader>
              <CardTitle>Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">
                {profileDisplayName ?? '—'}
              </p>
            </CardContent>
          </Card>
        ) : null}
        {!accountName ? (
          <Card>
            <CardHeader>
              <CardTitle>Log in</CardTitle>
              <CardDescription>
                Log in with your email and password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={handleSubmit(handleSignIn)}
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
                        autoComplete="current-password"
                        {...register('password', {
                          required: 'Password is required.',
                          minLength: {
                            value: 6,
                            message: 'Password must be at least 6 characters.',
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
                  <FieldError errors={[errors.password]} />
                </Field>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="submit" disabled={loading}>
                    Log in
                  </Button>
                </div>
              </form>
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                Don&apos;t have an account?{' '}
                <Link
                  className="underline underline-offset-4"
                  href="/create-account"
                >
                  Create account
                </Link>
              </p>
              {message ? (
                <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
                  {message}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
