-- CreateIndex
CREATE UNIQUE INDEX "holiday_cache_countryCode_subdivisionCode_holidayDate_key" ON "holiday_cache"("countryCode", "subdivisionCode", "holidayDate");

-- CreateIndex
CREATE INDEX "holiday_cache_countryCode_subdivisionCode_idx" ON "holiday_cache"("countryCode", "subdivisionCode");

-- CreateIndex
CREATE INDEX "holiday_cache_cachedUntil_idx" ON "holiday_cache"("cachedUntil");
