const guessForm = document.getElementById('guess-form');
const adminForm = document.getElementById('admin-form');
const guessSubmitButton = document.getElementById('guessSubmitButton');

guessForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  guessSubmitButton.disabled = true; 
  guessSubmitButton.style.backgroundColor = '#ccc';
  const formData = new FormData(guessForm);
  const data = {
    name : formData.get('name'),
    email : formData.get('email'),
    guess : formData.get('guess')
  };

  try {
    const response = await fetch('/api/guess', {
      method : 'POST',
      headers : {'Content-Type' : 'application/json'},
      body : JSON.stringify(data)
    });
    if (response.ok != true) {
      throw new Error(`Something wrong, status: ${response.status}`);
    }
    document.getElementById('name').value = '';
    document.getElementById('email').value = '';
    document.getElementById('guess').value = '';
    alert('Your guess has been submitted!');
  } catch (error) {
    console.error('Error:', error);
    alert('BBL Drizzy, BBL Drizzzzyyy');
  }
});

adminForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(adminForm);
  const data = {
    password : formData.get('password'),
    actual : formData.get('actual')
  };
  const response = await fetch('/api/admin', {
    method : 'POST',
    headers : {'Content-Type' : 'application/json'},
    body : JSON.stringify(data)
  });
  const result = await response.json();
  if (result.success) {
    alert('Actual activity submitted successfully!');
    adminForm.reset();
  } else {
    alert('Incorrect password!');
  }
});