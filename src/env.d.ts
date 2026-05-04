import type { Session } from '@/lib/auth';
import type { User } from '@/db/schema';

declare namespace App {
  interface Locals {
    session: Session;
    user: User;
  }
}