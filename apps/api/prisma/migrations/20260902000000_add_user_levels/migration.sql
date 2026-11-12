-- CreateTable
CREATE TABLE "user_levels" (
    "level" INTEGER NOT NULL,
    "xp_threshold" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "title_vi" VARCHAR(100) NOT NULL,
    "icon_url" VARCHAR(255),

    CONSTRAINT "user_levels_pkey" PRIMARY KEY ("level")
);
