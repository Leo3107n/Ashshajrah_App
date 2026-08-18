import prisma from "@/lib/prisma";

export async function syncLiveLectureStatuses() {
  await prisma.$executeRaw`
    UPDATE lecture_schedules
    SET status = 'live'::lecture_status, updated_at = NOW()
    WHERE scheduled_start <= NOW()
      AND scheduled_end >= NOW()
      AND LOWER(status::text) IN ('scheduled', 'upcoming')
  `;
}
