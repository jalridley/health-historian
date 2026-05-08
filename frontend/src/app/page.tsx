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
import { supabase } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthFormValues = {
  email: string;
  password: string;
};

export default function HomePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
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

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        setMessage(error.message);
        return;
      }
      setUserEmail(data.user?.email ?? null);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn: SubmitHandler<AuthFormValues> = async (values) => {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
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
      <div className="mb-4 text-2xl font-bold">HealthHistorian</div>
      <div className="flex flex-col gap-4">
        {userEmail ? (
          <Card>
            <CardHeader>
              <CardTitle>HealthHistorian</CardTitle>
              <CardDescription>Session controls</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <p>Signed in as: {userEmail}</p>
              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                disabled={loading}
              >
                Log out
              </Button>
            </CardContent>
          </Card>
        ) : null}
        {!userEmail ? (
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
