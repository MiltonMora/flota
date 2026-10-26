declare namespace App {
  interface Locals {
    session: import('@/lib/auth').Session;
    user: import('@/db/schema').User;
  }
}

