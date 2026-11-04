-- A removed person stays in the table so that old records keep their name, but leaves every list.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
