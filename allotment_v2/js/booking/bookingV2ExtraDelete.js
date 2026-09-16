function bookingV2ExtraDelete(id,bkId){ SB_EXTRAS=SB_EXTRAS.filter(e=>e.id!==id); sbExtrasPersist(); bookingV2Render(); bookingV2ExtraRender(); }
