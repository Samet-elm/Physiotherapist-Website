document.addEventListener('DOMContentLoaded', function() {
  // Sayfa yüklendiğinde tüm bölümler görünür (anasayfa mantığı)
  showAllSections();

  // Menü linklerine tıklama olayları
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const sectionId = this.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];

      if (sectionId === 'anasayfa') {
        showAllSections();  // Hepsini göster
      } else {
        showOnlySection(sectionId);  // Sadece seçileni göster
      }

      updateActiveNavLink(sectionId);
    });
  });
});

function showAllSections() {
  const sections = document.querySelectorAll('section');
  sections.forEach(section => {
    section.style.display = 'block';
  });
}

function showOnlySection(sectionId) {
  const sections = document.querySelectorAll('section');
  sections.forEach(section => {
    if (section.id === sectionId) {
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  });
}

function updateActiveNavLink(sectionId) {
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(link => {
    link.classList.remove('active');
    const targetId = link.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (targetId === sectionId) {
      link.classList.add('active');
    }
  });
}

function scrollServices(direction) {
  const container = document.querySelector('.services-container');
  const scrollAmount = 300;  // Kaydırma miktarı

  if (direction === -1) {
    // Sola kaydır
    container.scrollBy({left: -scrollAmount, behavior: 'smooth'});
  } else {
    // Sağa kaydır
    container.scrollBy({left: scrollAmount, behavior: 'smooth'});
  }
}


// RANDEVU SİSTEMİ - FORM ENTEGRASYONLU
document.addEventListener('DOMContentLoaded', function() {
  // Çalışma saatleri
  const workingHours = {
    start: 9,        // 09:00
    end: 17,         // 17:00
    breakStart: 12,  // 12:00
    breakEnd: 13     // 13:00
  };

  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let selectedDate = null;
  let selectedTime = null;

  // Sunucudan randevuları al ve takvimi oluştur
  fetch('http://127.0.0.1:3000/api/appointments')
      .then(res => {
        if (!res.ok) throw new Error('Sunucu hatası');
        return res.json();
      })
      .then(bookedAppointments => {
        const appointmentsByDate = {};
        bookedAppointments.forEach(app => {
          if (!appointmentsByDate[app.date]) {
            appointmentsByDate[app.date] = [];
          }
          appointmentsByDate[app.date].push(app.time);
        });

        generateCalendar(currentMonth, currentYear, appointmentsByDate);
        setupEventListeners(appointmentsByDate, workingHours);
      })
      .catch(error => {
        console.error('Randevular alınırken hata:', error);
        // Sunucu hatasında boş bir takvim göster
        generateCalendar(currentMonth, currentYear, {});
        setupEventListeners({}, workingHours);
      });

  function generateCalendar(month, year, appointmentsByDate) {
    const calendar = document.getElementById('calendar');
    if (!calendar) return;

    calendar.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Gün başlıkları
    const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    dayNames.forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-day-header';
      dayHeader.textContent = day;
      calendar.appendChild(dayHeader);
    });

    // Boş hücreler
    for (let i = 0; i < firstDay; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.className = 'calendar-day disabled';
      calendar.appendChild(emptyDay);
    }

    // Günler
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDate(date);
      const dayElement = document.createElement('div');
      dayElement.className = 'calendar-day';
      dayElement.textContent = day;

      // Geçmiş günler
      if (date < new Date().setHours(0, 0, 0, 0)) {
        dayElement.classList.add('disabled');
      }
      // Dolu randevular
      else if (
          appointmentsByDate[dateStr] &&
          appointmentsByDate[dateStr].length >= 6) {
        dayElement.classList.add('booked');
      }
      // Seçili gün
      else if (
          selectedDate && date.toDateString() === selectedDate.toDateString()) {
        dayElement.classList.add('selected');
      }
      // Boş günler
      else {
        dayElement.classList.add('available');
      }

      dayElement.addEventListener('click', function() {
        if (!this.classList.contains('disabled') &&
            !this.classList.contains('booked')) {
          selectDate(new Date(year, month, day), appointmentsByDate);
        }
      });

      calendar.appendChild(dayElement);
    }

    // Ay bilgisini güncelle
    const monthDisplay = document.getElementById('current-month');
    if (monthDisplay) {
      monthDisplay.textContent =
          new Date(year, month)
              .toLocaleDateString('tr-TR', {month: 'long', year: 'numeric'});
    }
  }

  function selectDate(date, appointmentsByDate) {
    selectedDate = date;
    selectedTime = null;

    // Takvimde seçimi güncelle
    document.querySelectorAll('.calendar-day').forEach(day => {
      day.classList.remove('selected');
    });

    const days = document.querySelectorAll('.calendar-day');
    const dayIndex = date.getDate() +
        new Date(date.getFullYear(), date.getMonth(), 1).getDay() - 1;
    if (days[dayIndex]) {
      days[dayIndex].classList.add('selected');
    }

    // Seçili tarihi göster
    const selectedDateElement = document.getElementById('selected-date');
    if (selectedDateElement) {
      selectedDateElement.textContent = date.toLocaleDateString(
          'tr-TR', {weekday: 'long', day: 'numeric', month: 'long'});
    }

    // Saat aralıklarını oluştur
    generateTimeSlots(date, appointmentsByDate, workingHours);
  }


  // script.js dosyasında generateTimeSlots fonksiyonunu güncelleyin
  function generateTimeSlots(date, appointmentsByDate, workingHours) {
    const timeSelect = document.getElementById('app-time');
    if (!timeSelect) return;

    // Önceki seçenekleri temizle (ilk "Saat seçiniz" seçeneği hariç)
    timeSelect.innerHTML = '<option value="">Saat seçiniz</option>';

    const dateStr = formatDate(date);
    const bookedTimes = appointmentsByDate[dateStr] || [];

    // Çalışma saatleri arasında döngü (09:00-17:00)
    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
      // Öğle arasını atla (12:00-13:00)
      if (hour >= workingHours.breakStart && hour < workingHours.breakEnd) {
        continue;
      }

      const time = `${hour.toString().padStart(2, '0')}:00`;
      const option = new Option(time, time);

      // Eğer saat doluysa devre dışı bırak ve işaretle
      if (bookedTimes.includes(time)) {
        option.disabled = true;
        option.textContent += ' (DOLU)';
      }

      timeSelect.add(option);
    }
  }

  function setupEventListeners(appointmentsByDate, workingHours) {
    // Ay değiştirme butonları
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener('click', function() {
        currentMonth--;
        if (currentMonth < 0) {
          currentMonth = 11;
          currentYear--;
        }
        generateCalendar(currentMonth, currentYear, appointmentsByDate);
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', function() {
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
        generateCalendar(currentMonth, currentYear, appointmentsByDate);
      });
    }

    // Saat seçimi değiştiğinde
    const timeSelect = document.getElementById('app-time');
    if (timeSelect) {
      timeSelect.addEventListener('change', function() {
        selectedTime = this.value;
      });
    }

    // Randevu talep butonu
    const requestBtn = document.getElementById('request-appointment');
    if (requestBtn) {
      requestBtn.addEventListener('click', function(e) {
        e.preventDefault();

        if (!selectedDate) {
          alert('Lütfen bir tarih seçiniz!');
          return;
        }

        const timeSelect = document.getElementById('app-time');
        if (!timeSelect.value) {
          alert('Lütfen bir saat seçiniz!');
          return;
        }

        const selectedOption = timeSelect.options[timeSelect.selectedIndex];
        if (selectedOption.disabled) {
          alert('Bu saat aralığı dolu, lütfen başka bir saat seçiniz!');
          return;
        }
        const name = document.getElementById('app-name').value;
        const email = document.getElementById('app-email').value;
        const phone = document.getElementById('app-phone').value;
        const notes = document.getElementById('app-notes').value;

        if (!name || !email || !phone) {
          alert('Lütfen zorunlu alanları doldurunuz!');
          return;
        }

        const formattedDate = formatDate(selectedDate);

        fetch('http://127.0.0.1:3000/api/appointments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: formattedDate,
            time: timeSelect.value,
            name: name,
            email: email,
            phone: phone,
            message: notes
          })
        })
            .then(response => {
              if (!response.ok) throw new Error('Randevu oluşturulamadı');
              return response.json();
            })
            .then(data => {
              alert(`Randevu talebiniz alındı!\n\nTarih: ${
                  selectedDate.toLocaleDateString('tr-TR')}\nSaat: ${
                  timeSelect
                      .value}\n\nEn kısa sürede sizinle iletişime geçeceğiz.`);
              // Formu temizle
              document.getElementById('app-name').value = '';
              document.getElementById('app-email').value = '';
              document.getElementById('app-phone').value = '';
              document.getElementById('app-notes').value = '';
              timeSelect.value = '';
              // Sayfayı yenile
              location.reload();
            })
            .catch(error => {
              console.error('Hata:', error);
              alert(
                  'Randevu oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
            });
      });
    }
  }


  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
