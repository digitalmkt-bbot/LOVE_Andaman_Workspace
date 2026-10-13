function bookingV2AttachFromInput(inp){ const fs=(inp&&inp.files)?Array.prototype.slice.call(inp.files):[]; fs.forEach(f=>bookingV2AttachUpload(f,'upload')); if(inp) inp.value=''; }
