/*
  Warnings:

  - You are about to drop the `app_runs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `app_versions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `apps` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pipeline_runs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "app_runs" DROP CONSTRAINT "app_runs_app_id_fkey";

-- DropForeignKey
ALTER TABLE "app_versions" DROP CONSTRAINT "app_versions_app_id_fkey";

-- DropForeignKey
ALTER TABLE "pipeline_runs" DROP CONSTRAINT "pipeline_runs_app_id_fkey";

-- DropTable
DROP TABLE "app_runs";

-- DropTable
DROP TABLE "app_versions";

-- DropTable
DROP TABLE "apps";

-- DropTable
DROP TABLE "pipeline_runs";

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "short_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "personality" JSONB,
    "original_prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 1024,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_numbers" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "twilio_sid" TEXT NOT NULL,
    "friendly_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "provisioned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "from_number" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "media_urls" JSONB NOT NULL DEFAULT '[]',
    "twilio_sid" TEXT,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_short_id_key" ON "agents"("short_id");

-- CreateIndex
CREATE INDEX "agents_short_id_idx" ON "agents"("short_id");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "agents_created_at_idx" ON "agents"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_agent_id_key" ON "phone_numbers"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_phone_number_key" ON "phone_numbers"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_twilio_sid_key" ON "phone_numbers"("twilio_sid");

-- CreateIndex
CREATE INDEX "phone_numbers_phone_number_idx" ON "phone_numbers"("phone_number");

-- CreateIndex
CREATE INDEX "phone_numbers_agent_id_idx" ON "phone_numbers"("agent_id");

-- CreateIndex
CREATE INDEX "conversations_agent_id_last_message_at_idx" ON "conversations"("agent_id", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_from_number_idx" ON "conversations"("from_number");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_agent_id_from_number_key" ON "conversations"("agent_id", "from_number");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_agent_id_created_at_idx" ON "messages"("agent_id", "created_at");

-- AddForeignKey
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
