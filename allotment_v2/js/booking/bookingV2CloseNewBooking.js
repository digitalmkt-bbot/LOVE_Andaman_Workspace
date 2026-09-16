function bookingV2CloseNewBooking(){
  if(_bkV2.newBooking){
    const isEditing = !!_bkV2.editingId;
    const hasData = _bkV2.newBooking.agentId || _bkV2.newBooking.leadPax;
    if(hasData){
      bookingV2ConfirmModal({
        title: isEditing ? 'Discard your edits?' : 'Discard this draft?',
        message: isEditing ? 'Your unsaved changes will be lost and you\'ll return to the booking detail.' : 'This booking draft will be discarded.',
        okText: 'Discard', cancelText: 'Keep editing', danger: true,
        onConfirm: _bkV2DoCloseNewBooking
      });
      return;
    }
  }
  _bkV2DoCloseNewBooking();
}
