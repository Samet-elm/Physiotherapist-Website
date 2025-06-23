
// DOM Elementleri
const calendarEl = document.getElementById('calendar');
const currentMonthEl = document.getElementById('current-month');
const selectedDateEl = document.getElementById('selected-date');
const appointmentsTable =
    document.getElementById('appointments-table').querySelector('tbody');
const editModal = document.getElementById('editModal');
const currentTimeEl = document.getElementById('current-time');
const timeSelect = document.getElementById('time-select');

// Takvim Değişkenleri
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let currentAppointmentId = null;

// Çalışma saatleri (09:00 - 17:00 arası, 30 dakikalık aralıklarla)
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 9; hour <= 17; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeStr =
          `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      slots.push(timeStr);
    }
  }
  return slots;
};
const workHours = generateTimeSlots();

// Takvimi Yükle
const loadCalendar = () => {
  calendarEl.innerHTML = '';

  // Haftanın günleri başlıkları
  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  dayNames.forEach(day => {
    const dayEl = document.createElement('div');
    dayEl.className = 'day-header';
    dayEl.textContent = day;
    calendarEl.appendChild(dayEl);
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Boş günler
  for (let i = 0; i < firstDay; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day disabled';
    calendarEl.appendChild(emptyDay);
  }

  // Takvim günleri
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;

    const dateStr =
        `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${
            String(day).padStart(2, '0')}`;

    // Randevu sayısını göster
    /*fetchAppointmentCount(dateStr).then(count => {
      if (count > 0) {
        const countEl = document.createElement('span');
        countEl.className = 'appointment-count';
        countEl.textContent = count;
        dayEl.appendChild(countEl);
      }
    }); */

    dayEl.addEventListener('click', () => {
      selectedDate = dateStr;
      selectedDateEl.textContent = selectedDate;
      loadAppointments(selectedDate);
    });

    calendarEl.appendChild(dayEl);
  }

  currentMonthEl.textContent =
      new Date(currentYear, currentMonth)
          .toLocaleDateString('tr-TR', {month: 'long', year: 'numeric'});
};

// Randevu sayısını getir
const fetchAppointmentCount = async (date) => {
  try {
    const response =
        await fetch(`http://127.0.0.1:3000/api/appointments?date=${date}`);
    const data = await response.json();
    return data.length;
  } catch (err) {
    console.error('Randevu sayısı alınırken hata:', err);
    return 0;
  }
};

// Randevuları yükle
const loadAppointments = (date) => {
  fetch(`http://127.0.0.1:3000/api/appointments?date=${date}`)
      .then(res => res.json())
      .then(data => {
        appointmentsTable.innerHTML = '';

        if (data.length === 0) {
          const row = document.createElement('tr');
          row.innerHTML =
              `<td colspan="7" class="no-appointments">Bu tarihte randevu bulunmamaktadır</td>`;
          appointmentsTable.appendChild(row);
          return;
        }

        data.forEach(appt => {
          const row = document.createElement('tr');
          row.innerHTML = `
              <td>${appt.id}</td>
              <td>${appt.time}</td>
              <td>${appt.name}</td>
              <td>${appt.phone}</td>
              <td>${appt.email}</td>
              <td>${formatDateTime(appt.created_at)}</td>
              <td>
                <button class="edit-btn" onclick="openEditModal('${
              appt.id}', '${appt.time}')">Düzenle</button>
                <button class="delete-btn" onclick="deleteAppointment('${
              appt.id}')">Sil</button>
              </td>
            `;
          appointmentsTable.appendChild(row);
        });
      })
      .catch(err => {
        console.error('Randevular yüklenirken hata:', err);
        const row = document.createElement('tr');
        row.innerHTML =
            `<td colspan="7" style="color: red;">Randevular yüklenirken hata oluştu</td>`;
        appointmentsTable.appendChild(row);
      });
};

// Tarih formatı
const formatDateTime = (datetimeStr) => {
  if (!datetimeStr) return '-';
  const date = new Date(datetimeStr);
  return date.toLocaleString('tr-TR');
};

// Randevu sil
const deleteAppointment = (id) => {
  if (confirm('Bu randevuyu silmek istediğinize emin misiniz?')) {
    fetch(`http://127.0.0.1:3000/api/appointments/${id}`, {method: 'DELETE'})
        .then(() => {
          alert('Randevu başarıyla silindi!');
          loadAppointments(selectedDate);
          loadCalendar();  // Takvimi yenile (randevu sayıları güncellensin)
        })
        .catch(err => {
          console.error('Randevu silinirken hata:', err);
          alert('Randevu silinirken hata oluştu!');
        });
  }
};

const openEditModal = (id, currentTime) => {
  currentAppointmentId = id;
  currentTimeEl.textContent = currentTime;

  // Seçili tarihteki randevuları çek
  fetch(`http://127.0.0.1:3000/api/appointments?date=${selectedDate}`)
      .then(res => res.json())
      .then(appointments => {
        const bookedTimes = appointments.map(appt => appt.time);

        timeSelect.innerHTML = '';
        workHours.forEach(time => {
          const option = document.createElement('option');
          option.value = time;
          option.textContent = time;

          // Dolu saatleri işaretle (mevcut randevu hariç)
          if (bookedTimes.includes(time) && time !== currentTime) {
            option.textContent += ' (DOLU)';
            option.disabled = true;
          }

          if (time === currentTime) {
            option.selected = true;
          }

          timeSelect.appendChild(option);
        });
      });

  editModal.style.display = 'block';
};

// Modalı kapat
const closeModal = () => {
  editModal.style.display = 'none';
};

// Randevu saatini kaydet
const saveAppointmentTime = () => {
  const newTime = timeSelect.value;
  if (!newTime) {
    alert('Lütfen geçerli bir saat seçin!');
    return;
  }

  fetch(`http://127.0.0.1:3000/api/appointments/${currentAppointmentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({time: newTime, date: selectedDate})
  })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(err.error || 'Güncelleme başarısız');
          });
        }
        return response.json();
      })
      .then(() => {
        alert('Randevu saati başarıyla güncellendi!');
        closeModal();
        loadAppointments(selectedDate);
        loadCalendar();  // Takvimi yenile (randevu sayıları güncellensin)
      })
      .catch(error => {
        console.error('Hata:', error);
        alert(error.message || 'Randevu güncellenirken bir hata oluştu');
      });
};

// Randevuları yenile
const refreshAppointments = () => {
  if (selectedDate) {
    loadAppointments(selectedDate);
    loadCalendar();
  } else {
    alert('Lütfen bir gün seçin!');
  }
};

// Event Listeners
document.getElementById('prev-month').addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  loadCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  loadCalendar();
});

document.getElementById('save-time-btn')
    .addEventListener('click', saveAppointmentTime);

// Sayfa yüklendiğinde takvimi yükle
loadCalendar();
