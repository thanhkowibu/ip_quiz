// Quiz Application
class QuizApp {
  constructor() {
    this.questions = [];
    this.originalQuestions = []; // Store original order
    this.currentQuestionIndex = 0;
    this.userAnswers = [];
    this.evaluatedQuestions = []; // Track which questions have been evaluated (for multiple choice)
    this.selectedAnswer = null;
    this.currentDataFile = null; // Store current file
    this.currentFileName = null; // Store file name
    this.autoAdvanceTimeout = null;
    this.shuffleAnswersEnabled = false; // Toggle for shuffling answer options
    this.questionShuffleMaps = {}; // Store shuffle mapping for each question: { questionIndex: { shuffledOptions, originalToShuffled, shuffledToOriginal, shuffledCorrectIndex, shuffledCorrectIndices } }
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.showFileSelection();
  }

  showFileSelection() {
    document.getElementById("quiz-card").style.display = "none";
    document.getElementById("navigation-buttons").style.display = "none";
    document.getElementById("progress-container").style.display = "none";
    document.getElementById("file-selection").style.display = "flex";
  }

  async startQuiz(
    dataFile,
    fileName,
    questionsToStudy = null,
    shouldShuffle = false,
  ) {
    if (this.autoAdvanceTimeout) {
      clearTimeout(this.autoAdvanceTimeout);
    }
    document.getElementById("file-selection").style.display = "none";
    document.getElementById("quiz-card").style.display = "block";
    document.getElementById("navigation-buttons").style.display = "flex";
    document.getElementById("progress-container").style.display = "block";

    this.currentDataFile = dataFile;
    this.currentFileName = fileName;

    if (questionsToStudy) {
      // Studying specific questions (e.g., only incorrect ones)
      this.originalQuestions = [...questionsToStudy];
      this.questions = shouldShuffle
        ? this.shuffleArray([...questionsToStudy])
        : [...questionsToStudy];
    } else {
      // Loading fresh questions from file
      await this.loadQuestions(dataFile, shouldShuffle);
    }

    this.currentQuestionIndex = 0;
    this.userAnswers = new Array(this.questions.length).fill(null);
    this.evaluatedQuestions = new Array(this.questions.length).fill(false);
    this.questionShuffleMaps = {}; // Clear shuffle maps for new quiz

    // Update shuffle button state
    const shuffleBtn = document.getElementById("shuffle-toggle-btn");
    if (shuffleBtn) {
      shuffleBtn.classList.toggle("active", this.shuffleAnswersEnabled);
    }

    // Update total questions count (for both fresh load and study incorrect)
    document.getElementById("total-questions").textContent =
      this.questions.length;
    this.renderQuestion();
  }

  async loadQuestions(dataFile, shouldShuffle = false) {
    try {
      const response = await fetch(dataFile);
      if (!response.ok) {
        throw new Error(`Could not load ${dataFile}`);
      }

      const data = await response.json();

      // Store original order
      this.originalQuestions = [...data];

      // Shuffle or keep original order
      this.questions = shouldShuffle ? this.shuffleArray([...data]) : [...data];
      this.userAnswers = new Array(this.questions.length).fill(null);
      this.evaluatedQuestions = new Array(this.questions.length).fill(false);

      // Update total questions count
      document.getElementById("total-questions").textContent =
        this.questions.length;
    } catch (error) {
      console.error("Error loading questions:", error);
      document.getElementById("question-text").textContent =
        "Không thể tải câu hỏi. Vui lòng kiểm tra lại dữ liệu.";
    }
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  toggleShuffleAnswers() {
    const wasEnabled = this.shuffleAnswersEnabled;
    this.shuffleAnswersEnabled = !this.shuffleAnswersEnabled;
    const btn = document.getElementById("shuffle-toggle-btn");
    if (btn) {
      btn.classList.toggle("active", this.shuffleAnswersEnabled);
    }

    // If turning shuffle off, convert user answers from shuffled indices back to original
    if (wasEnabled && !this.shuffleAnswersEnabled) {
      this.questions.forEach((question, index) => {
        const shuffleMap = this.questionShuffleMaps[index];
        if (shuffleMap && shuffleMap.shuffledToOriginal) {
          const userAnswer = this.userAnswers[index];
          if (userAnswer !== null && userAnswer !== undefined) {
            if (Array.isArray(userAnswer)) {
              // Multiple choice: convert each shuffled index to original
              this.userAnswers[index] = userAnswer.map(
                (shuffledIdx) => shuffleMap.shuffledToOriginal[shuffledIdx],
              );
            } else {
              // Single choice: convert shuffled index to original
              this.userAnswers[index] =
                shuffleMap.shuffledToOriginal[userAnswer];
            }
          }
        }
      });
    }

    // Clear existing shuffle maps when toggling
    this.questionShuffleMaps = {};

    // Re-render current question with new shuffle state
    if (this.questions.length > 0) {
      this.renderQuestion();
    }
  }

  shuffleQuestionOptions(question, questionIndex) {
    // If shuffle is disabled or no options, return original
    if (
      !this.shuffleAnswersEnabled ||
      !question.options ||
      question.options.length === 0
    ) {
      return {
        shuffledOptions: question.options || [],
        originalToShuffled: question.options
          ? question.options.map((_, i) => i)
          : [],
        shuffledToOriginal: question.options
          ? question.options.map((_, i) => i)
          : [],
        shuffledCorrectIndex: question.correctAnswerIndex,
        shuffledCorrectIndices: question.correctAnswerIndices || [],
      };
    }

    // Check if we already have a shuffle map for this question
    if (this.questionShuffleMaps[questionIndex]) {
      return this.questionShuffleMaps[questionIndex];
    }

    // Create pairs of [option, originalIndex] for shuffling
    const optionsWithIndices = question.options.map((option, index) => ({
      option,
      originalIndex: index,
    }));

    // Shuffle the pairs
    const shuffledPairs = this.shuffleArray(optionsWithIndices);

    // Extract shuffled options and create mapping
    const shuffledOptions = shuffledPairs.map((pair) => pair.option);
    const shuffledToOriginal = shuffledPairs.map((pair) => pair.originalIndex);
    const originalToShuffled = new Array(question.options.length);
    shuffledToOriginal.forEach((originalIdx, shuffledIdx) => {
      originalToShuffled[originalIdx] = shuffledIdx;
    });

    // Map correct answer indices
    let shuffledCorrectIndex = question.correctAnswerIndex;
    if (
      question.correctAnswerIndex !== undefined &&
      question.correctAnswerIndex !== null
    ) {
      shuffledCorrectIndex = originalToShuffled[question.correctAnswerIndex];
    }

    let shuffledCorrectIndices = [];
    if (
      question.correctAnswerIndices &&
      Array.isArray(question.correctAnswerIndices)
    ) {
      shuffledCorrectIndices = question.correctAnswerIndices.map(
        (origIdx) => originalToShuffled[origIdx],
      );
    }

    // Store the shuffle map
    const shuffleMap = {
      shuffledOptions,
      originalToShuffled,
      shuffledToOriginal,
      shuffledCorrectIndex,
      shuffledCorrectIndices,
    };

    this.questionShuffleMaps[questionIndex] = shuffleMap;
    return shuffleMap;
  }

  setupEventListeners() {
    document
      .getElementById("prev-btn")
      .addEventListener("click", () => this.previousQuestion());
    document
      .getElementById("next-btn")
      .addEventListener("click", () => this.nextQuestion());

    // Shuffle answers toggle
    const shuffleToggleBtn = document.getElementById("shuffle-toggle-btn");
    if (shuffleToggleBtn) {
      shuffleToggleBtn.addEventListener("click", () =>
        this.toggleShuffleAnswers(),
      );
    }
  }

  renderQuestion() {
    if (this.currentQuestionIndex >= this.questions.length) {
      this.showResults();
      return;
    }

    const question = this.questions[this.currentQuestionIndex];

    // Get shuffled options if shuffle is enabled
    const shuffleMap = this.shuffleQuestionOptions(
      question,
      this.currentQuestionIndex,
    );
    const displayOptions = shuffleMap.shuffledOptions;
    const correctAnswerIndex = shuffleMap.shuffledCorrectIndex;
    const correctAnswerIndices = shuffleMap.shuffledCorrectIndices;

    const isMultiple =
      question.type === "multiple" ||
      (Array.isArray(correctAnswerIndices) && correctAnswerIndices.length > 0);

    this.selectedAnswer = this.userAnswers[this.currentQuestionIndex];

    // Update progress
    document.getElementById("current-question").textContent =
      this.currentQuestionIndex + 1;
    const progress =
      ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
    document.getElementById("progress-fill").style.width = `${progress}%`;

    // Update question text using marked
    // Replace \n with actual newlines if they are escaped?
    // The JSON has literal \n. marked handles them.
    // We wrap it in a div to preserve styling
    const qText = question.question.replace(/\n/g, "\n\n"); // Markdown often needs double newline for break
    document.getElementById("question-text").innerHTML = marked.parse(qText);

    // Handle question image (if any)
    const questionContent = document.getElementById("question-content");
    let imageElement = questionContent.querySelector(".question-image");
    if (question.image) {
      if (!imageElement) {
        imageElement = document.createElement("img");
        imageElement.className = "question-image";
        questionContent.appendChild(imageElement);
      }
      imageElement.src = question.image;
      imageElement.alt = "Minh họa câu hỏi";
      imageElement.style.display = "block";
    } else if (imageElement) {
      imageElement.style.display = "none";
    }

    // Render options or input
    const optionsGrid = document.getElementById("options-grid");
    optionsGrid.innerHTML = "";

    if (question.type === "fill_in_blank") {
      optionsGrid.style.display = "block"; // Full width for input

      // Check if we have a correctAnswer to validate against
      const hasCorrectAnswer =
        question.correctAnswer && question.correctAnswer.trim();

      optionsGrid.innerHTML = `
                <div class="input-container">
                    <input type="text" id="fill-input" class="fill-input" placeholder="${hasCorrectAnswer ? "Nhập câu trả lời của bạn..." : "Câu hỏi này không có đáp án tự động kiểm tra"}" autocomplete="off" ${!hasCorrectAnswer ? "disabled" : ""}>
                    <div id="fill-feedback" class="fill-feedback"></div>
                </div>
            `;

      const input = document.getElementById("fill-input");

      // Restore answer if exists
      if (this.userAnswers[this.currentQuestionIndex]) {
        input.value = this.userAnswers[this.currentQuestionIndex];
      }

      if (this.evaluatedQuestions[this.currentQuestionIndex]) {
        input.disabled = true;
        if (hasCorrectAnswer) {
          const isCorrect = this.checkFillAnswer(
            input.value,
            question.correctAnswer,
          );
          const feedback = document.getElementById("fill-feedback");
          if (isCorrect) {
            input.classList.add("correct");
            feedback.innerHTML = `<span class="status-correct">✓ Chính xác!</span>`;
          } else {
            input.classList.add("incorrect");
            feedback.innerHTML = `<span class="status-incorrect">✗ Sai. Đáp án đúng: <strong>${question.correctAnswer}</strong></span>`;
          }
        } else {
          const feedback = document.getElementById("fill-feedback");
          feedback.innerHTML = `<span class="status-correct">✓ Đã ghi nhận (câu này không có đáp án kiểm tra tự động)</span>`;
        }
      } else {
        if (hasCorrectAnswer) {
          input.addEventListener("input", (e) => {
            this.userAnswers[this.currentQuestionIndex] = e.target.value;
          });
          // Allow Enter key to submit
          input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
              this.nextQuestion();
            }
          });
        }
      }
    } else if (!displayOptions || displayOptions.length === 0) {
      // No options and not fill_in_blank - show message
      optionsGrid.style.display = "block";
      optionsGrid.innerHTML = `<div class="fill-feedback"><span class="status-correct">Câu hỏi này không có lựa chọn</span></div>`;
    } else {
      optionsGrid.style.display = "grid"; // Grid for buttons
      // ... standard option rendering code ...
      const isEvaluated = this.evaluatedQuestions[this.currentQuestionIndex];

      displayOptions.forEach((option, shuffledIndex) => {
        const button = document.createElement("button");
        button.className = "option-btn";
        button.innerHTML = `
                    <span class="option-number">${shuffledIndex + 1}</span>
                    <span class="option-text">${marked.parseInline(option)}</span>
                `;

        // Restore selection state (using shuffled indices)
        const isSelected = isMultiple
          ? Array.isArray(this.selectedAnswer) &&
            this.selectedAnswer.includes(shuffledIndex)
          : this.selectedAnswer !== null &&
            this.selectedAnswer === shuffledIndex;
        if (isSelected) {
          button.classList.add("selected");
        }

        if (isEvaluated) {
          // Once evaluated, show correct/incorrect and disable buttons
          if (isMultiple) {
            const isCorrectOption =
              correctAnswerIndices.includes(shuffledIndex);
            if (isCorrectOption) {
              button.classList.add("correct");
            }
            if (isSelected && !isCorrectOption) {
              button.classList.add("incorrect");
            }
          } else {
            if (shuffledIndex === correctAnswerIndex) {
              button.classList.add("correct");
            }
            if (isSelected && shuffledIndex !== correctAnswerIndex) {
              button.classList.add("incorrect");
            }
          }
          button.disabled = true;
        } else {
          // Not evaluated yet: allow user interaction (pass shuffled index)
          button.addEventListener("click", () =>
            this.handleOptionClick(shuffledIndex, button),
          );
        }

        optionsGrid.appendChild(button);
      });
    }

    // Update result message
    this.updateResultMessage();

    // Update navigation buttons
    document.getElementById("prev-btn").disabled =
      this.currentQuestionIndex === 0;

    const nextBtn = document.getElementById("next-btn");
    if (this.currentQuestionIndex === this.questions.length - 1) {
      nextBtn.innerHTML = `
                Xem kết quả
            `;
    } else {
      // Contextual text for Fill in Blank?
      if (
        question.type === "fill_in_blank" &&
        !this.evaluatedQuestions[this.currentQuestionIndex]
      ) {
        nextBtn.innerHTML = `Kiểm tra`;
      } else {
        nextBtn.innerHTML = `Câu tiếp theo`;
      }
    }

    // Add animation
    const quizCard = document.getElementById("quiz-card");
    quizCard.style.animation = "none";
    setTimeout(() => {
      quizCard.style.animation = "fadeIn 0.6s ease-out";
    }, 10);
  }

  handleOptionClick(answerIndex, button) {
    // Clear any existing timeout
    if (this.autoAdvanceTimeout) {
      clearTimeout(this.autoAdvanceTimeout);
    }

    const question = this.questions[this.currentQuestionIndex];
    const isMultiple =
      question.type === "multiple" ||
      (Array.isArray(question.correctAnswerIndices) &&
        question.correctAnswerIndices.length > 0);

    if (isMultiple) {
      // Toggle selection for multiple choice
      let currentSelection = this.userAnswers[this.currentQuestionIndex];
      if (!Array.isArray(currentSelection)) {
        currentSelection = [];
      }

      if (currentSelection.includes(answerIndex)) {
        // Unselect
        currentSelection = currentSelection.filter((i) => i !== answerIndex);
        button.classList.remove("selected");
      } else {
        currentSelection.push(answerIndex);
        button.classList.add("selected");
      }

      this.userAnswers[this.currentQuestionIndex] =
        currentSelection.length > 0 ? currentSelection : null;
      this.selectedAnswer = this.userAnswers[this.currentQuestionIndex];

      // Do not evaluate yet; user will click "Câu tiếp theo" to submit
      this.updateResultMessage();
    } else {
      this.evaluateSingleChoice(answerIndex, button);
    }
  }

  evaluateSingleChoice(answerIndex, button) {
    const question = this.questions[this.currentQuestionIndex];

    // Get shuffled correct index
    const shuffleMap = this.shuffleQuestionOptions(
      question,
      this.currentQuestionIndex,
    );
    const correctAnswerIndex = shuffleMap.shuffledCorrectIndex;

    this.selectedAnswer = answerIndex;
    this.userAnswers[this.currentQuestionIndex] = answerIndex;

    // Disable all buttons
    const allButtons = document.querySelectorAll(".option-btn");
    allButtons.forEach((btn) => (btn.disabled = true));

    // Mark selected button
    button.classList.add("selected");

    // Check if correct (using shuffled indices)
    const isCorrect = answerIndex === correctAnswerIndex;

    if (isCorrect) {
      button.classList.add("correct");
    } else {
      button.classList.add("incorrect");
      // Show the correct answer (if valid index exists)
      if (correctAnswerIndex >= 0 && correctAnswerIndex < allButtons.length) {
        allButtons[correctAnswerIndex].classList.add("correct");
      }
    }

    this.evaluatedQuestions[this.currentQuestionIndex] = true;

    // Show result message
    this.updateResultMessage();

    // Auto advance after 1.5 seconds
    this.autoAdvanceTimeout = setTimeout(() => {
      if (this.currentQuestionIndex < this.questions.length - 1) {
        this.nextQuestion();
      } else {
        this.showResults();
      }
    }, 1500);
  }

  updateResultMessage() {
    const resultMessage = document.getElementById("result-message");
    const question = this.questions[this.currentQuestionIndex];

    if (!this.evaluatedQuestions[this.currentQuestionIndex]) {
      resultMessage.classList.remove("show", "correct", "incorrect");
      return;
    }

    resultMessage.classList.add("show");

    // Get shuffled options and correct indices
    const shuffleMap = this.shuffleQuestionOptions(
      question,
      this.currentQuestionIndex,
    );
    const displayOptions = shuffleMap.shuffledOptions;
    const correctAnswerIndex = shuffleMap.shuffledCorrectIndex;
    const correctAnswerIndices = shuffleMap.shuffledCorrectIndices;

    const isMultiple =
      question.type === "multiple" ||
      (Array.isArray(correctAnswerIndices) && correctAnswerIndices.length > 0);

    const isFillInBlank = question.type === "fill_in_blank";

    let isCorrect = false;
    let correctAnswerDisplay = "";

    if (isFillInBlank) {
      const userAns = this.userAnswers[this.currentQuestionIndex];
      isCorrect = this.checkFillAnswer(userAns, question.correctAnswer);
      correctAnswerDisplay = question.correctAnswer || "N/A";
    } else if (isMultiple) {
      const selected = this.userAnswers[this.currentQuestionIndex];
      if (Array.isArray(selected)) {
        const correctSet = new Set(correctAnswerIndices);
        const selectedSet = new Set(selected);
        isCorrect =
          correctSet.size === selectedSet.size &&
          [...correctSet].every((i) => selectedSet.has(i));
      }
      // Display correct answer indices (+1 for human-readable, using shuffled positions)
      correctAnswerDisplay = correctAnswerIndices.map((i) => i + 1).join(", ");
    } else {
      // Single choice (using shuffled indices)
      isCorrect = this.selectedAnswer === correctAnswerIndex;
      // Display correct answer index (+1) or the option text if available
      const idx = correctAnswerIndex;
      if (idx >= 0 && displayOptions && displayOptions[idx]) {
        correctAnswerDisplay = `${idx + 1}. ${displayOptions[idx]}`;
      } else if (idx >= 0) {
        correctAnswerDisplay = `Đáp án ${idx + 1}`;
      } else {
        correctAnswerDisplay = "Không xác định";
      }
    }

    if (isCorrect) {
      resultMessage.classList.remove("incorrect");
      resultMessage.classList.add("correct");
      resultMessage.textContent = "✓ Chính xác!";
    } else {
      resultMessage.classList.remove("correct");
      resultMessage.classList.add("incorrect");
      resultMessage.textContent = `✗ Đáp án đúng: ${correctAnswerDisplay}`;
    }
  }

  checkFillAnswer(userAns, correctAns) {
    if (!userAns || !correctAns) return false;
    // Normalize: remove whitespace, lowercase
    const cleanUser = userAns.toString().trim().toLowerCase();
    const cleanCorrect = correctAns.toString().trim().toLowerCase();
    return cleanUser === cleanCorrect;
  }

  nextQuestion() {
    if (this.autoAdvanceTimeout) {
      clearTimeout(this.autoAdvanceTimeout);
    }

    const question = this.questions[this.currentQuestionIndex];
    const isMultiple =
      question.type === "multiple" ||
      (Array.isArray(question.correctAnswerIndices) &&
        question.correctAnswerIndices.length > 0);

    // Handle Fill in Blank submission
    if (
      question.type === "fill_in_blank" &&
      !this.evaluatedQuestions[this.currentQuestionIndex]
    ) {
      const val = this.userAnswers[this.currentQuestionIndex];
      if (!val) {
        // require input? or mark as incorrect?
        // Let's require input or allow empty as wrong.
        // Just proceed to evaluate.
      }
      this.evaluatedQuestions[this.currentQuestionIndex] = true;
      this.renderQuestion(); // Re-render to show feedback
      return; // Stop here, user sees feedback first.
    }

    // For multiple-choice questions: first click on "Câu tiếp theo" will submit & chấm điểm
    if (isMultiple && !this.evaluatedQuestions[this.currentQuestionIndex]) {
      const evaluated = this.evaluateCurrentMultipleChoice();
      if (!evaluated) {
        // No option selected, do not move to next question
        return;
      }

      // Auto-advance after 1.5s (same như câu only choice)
      this.autoAdvanceTimeout = setTimeout(() => {
        if (this.currentQuestionIndex < this.questions.length - 1) {
          this.currentQuestionIndex++;
          this.renderQuestion();
        } else {
          this.showResults();
        }
      }, 1500);
      return;
    }

    // Default behavior
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.renderQuestion();
    } else {
      this.showResults();
    }
  }

  evaluateCurrentMultipleChoice() {
    const question = this.questions[this.currentQuestionIndex];

    // Get shuffled correct indices
    const shuffleMap = this.shuffleQuestionOptions(
      question,
      this.currentQuestionIndex,
    );
    const correctIndices = shuffleMap.shuffledCorrectIndices;

    const selected = this.userAnswers[this.currentQuestionIndex];

    if (!Array.isArray(selected) || selected.length === 0) {
      return false;
    }

    const correctSet = new Set(correctIndices);
    const selectedSet = new Set(selected);

    const allButtons = document.querySelectorAll(".option-btn");
    allButtons.forEach((btn, shuffledIndex) => {
      const isCorrectOption = correctSet.has(shuffledIndex);
      const isSelected = selectedSet.has(shuffledIndex);

      if (isCorrectOption) {
        btn.classList.add("correct");
      }
      if (isSelected && !isCorrectOption) {
        btn.classList.add("incorrect");
      }
      btn.disabled = true;
    });

    this.selectedAnswer = selected;
    this.evaluatedQuestions[this.currentQuestionIndex] = true;
    this.updateResultMessage();

    return true;
  }

  previousQuestion() {
    if (this.autoAdvanceTimeout) {
      clearTimeout(this.autoAdvanceTimeout);
    }
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.renderQuestion();
    }
  }

  showResults() {
    let correctCount = 0;
    const incorrectQuestions = [];

    this.questions.forEach((question, index) => {
      const userAnswer = this.userAnswers[index];

      if (question.type === "fill_in_blank") {
        // If no correctAnswer, treat as correct (can't verify)
        if (!question.correctAnswer || !question.correctAnswer.trim()) {
          correctCount++;
        } else if (this.checkFillAnswer(userAnswer, question.correctAnswer)) {
          correctCount++;
        } else {
          incorrectQuestions.push(question);
        }
      } else if (
        question.type === "multiple" ||
        (Array.isArray(question.correctAnswerIndices) &&
          question.correctAnswerIndices.length > 0)
      ) {
        // Get shuffle map to convert shuffled indices back to original
        const shuffleMap = this.questionShuffleMaps[index];
        const correctIndices = question.correctAnswerIndices || [];

        if (Array.isArray(userAnswer)) {
          // Convert shuffled user answer indices back to original indices
          let originalUserAnswer = userAnswer;
          if (shuffleMap && shuffleMap.shuffledToOriginal) {
            originalUserAnswer = userAnswer.map(
              (shuffledIdx) => shuffleMap.shuffledToOriginal[shuffledIdx],
            );
          }

          const correctSet = new Set(correctIndices);
          const selectedSet = new Set(originalUserAnswer);
          const isCorrect =
            correctSet.size === selectedSet.size &&
            [...correctSet].every((i) => selectedSet.has(i));
          if (isCorrect) {
            correctCount++;
          } else {
            incorrectQuestions.push(question);
          }
        } else {
          incorrectQuestions.push(question);
        }
      } else {
        // Single choice - convert shuffled index back to original
        const shuffleMap = this.questionShuffleMaps[index];
        let originalUserAnswer = userAnswer;
        if (
          shuffleMap &&
          shuffleMap.shuffledToOriginal &&
          userAnswer !== null
        ) {
          originalUserAnswer = shuffleMap.shuffledToOriginal[userAnswer];
        }

        if (originalUserAnswer === question.correctAnswerIndex) {
          correctCount++;
        } else {
          incorrectQuestions.push(question);
        }
      }
    });

    const incorrectCount = this.questions.length - correctCount;
    const accuracy = Math.round((correctCount / this.questions.length) * 100);

    document.getElementById("correct-count").textContent = correctCount;
    document.getElementById("incorrect-count").textContent = incorrectCount;
    document.getElementById("accuracy").textContent = `${accuracy}%`;

    // Store incorrect questions for "study incorrect only" option
    this.incorrectQuestions = incorrectQuestions;

    // Show/hide "study incorrect" buttons based on whether there are any incorrect answers
    const studyIncorrectBtns = document.querySelectorAll(
      ".study-incorrect-btn",
    );
    studyIncorrectBtns.forEach((btn) => {
      btn.style.display = incorrectCount > 0 ? "flex" : "none";
    });

    document.getElementById("results-screen").style.display = "flex";
  }

  restartAll(shouldShuffle) {
    document.getElementById("results-screen").style.display = "none";
    this.startQuiz(
      this.currentDataFile,
      this.currentFileName,
      null,
      shouldShuffle,
    );
  }

  restartIncorrect(shouldShuffle) {
    if (this.incorrectQuestions && this.incorrectQuestions.length > 0) {
      document.getElementById("results-screen").style.display = "none";
      this.startQuiz(
        null,
        this.currentFileName,
        this.incorrectQuestions,
        shouldShuffle,
      );
    }
  }

  backToMenu() {
    this.currentQuestionIndex = 0;
    this.userAnswers = [];
    this.selectedAnswer = null;
    this.questions = [];
    this.incorrectQuestions = [];

    document.getElementById("results-screen").style.display = "none";
    this.showFileSelection();
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.quizApp = new QuizApp();
});
