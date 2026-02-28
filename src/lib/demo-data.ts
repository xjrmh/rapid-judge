// Demo data for each evaluation tab.
// Used by the "Load Demo" buttons to pre-fill forms with realistic examples.

export const SINGLE_DEMO = {
  rubricId: "builtin-helpfulness",
  prompt: `Explain the concept of gradient descent to a software engineer who has never studied machine learning. Use an analogy to make it concrete.`,

  response: `Gradient descent is the core optimization algorithm used to train machine learning models. Here's how to think about it:

**The Hiking Analogy**
Imagine you're blindfolded on a hilly landscape and your goal is to find the lowest valley. You can't see anything, but you can feel the slope under your feet. Your strategy: take a small step in whichever direction feels most downhill. Repeat until you stop going down — that's your valley.

In machine learning, the "landscape" is a mathematical function called the **loss function** (or cost function). It measures how wrong the model's predictions are. Lower is better. The "position" in the landscape represents the model's parameters (weights and biases).

**How It Works**
1. Start at a random position (random initial weights)
2. Calculate the gradient — the mathematical equivalent of "which direction is uphill?" — using calculus
3. Take a step in the *opposite* direction (downhill)
4. Repeat until the loss stops improving

**The Learning Rate**
The size of each step is called the **learning rate**. Too large and you overshoot the valley (oscillating or diverging). Too small and training takes forever. Finding the right learning rate is one of the key hyperparameter choices in ML.

**Common Variants**
- *Batch gradient descent*: uses the entire dataset per step (slow but stable)
- *Stochastic gradient descent (SGD)*: uses one random sample per step (noisy but fast)
- *Mini-batch*: compromise between the two, standard in practice

The key insight: you never need to know the shape of the whole landscape — you only ever need to know the local slope at your current position. That's what makes gradient descent tractable for models with millions of parameters.`,

  context: `The audience is an experienced software engineer (5+ years) comfortable with math but new to ML. They're evaluating whether to take an ML course.`,
};

export const PAIRWISE_DEMO = {
  rubricId: "builtin-overall",
  prompt: `Write a Python function that checks if a given number is prime. Include a brief explanation of your approach.`,

  responseA: `def is_prime(n):
    if n < 2:
        return False
    for i in range(2, n):
        if n % i == 0:
            return False
    return True

# Explanation:
# We check if any number from 2 to n-1 divides n evenly.
# If none do, n is prime. If n < 2, it's not prime by definition.`,

  responseB: `def is_prime(n: int) -> bool:
    """Return True if n is a prime number, False otherwise."""
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False
    # Only check odd divisors up to sqrt(n)
    i = 3
    while i * i <= n:
        if n % i == 0:
            return False
        i += 2
    return True

# Explanation:
# Key optimizations over the naive O(n) approach:
# 1. Handle even numbers as a special case — only 2 is prime among evens.
# 2. Only check odd divisors starting from 3.
# 3. Stop at sqrt(n): if n has a factor > sqrt(n), it must have a corresponding
#    factor < sqrt(n) that we'd have already found.
# This gives O(sqrt(n)) time complexity — dramatically faster for large numbers.
# Example: for n = 1,000,000,007, we check ~15,811 divisors instead of 1,000,000,006.`,

  labelA: "GPT-4o mini",
  labelB: "Claude 3.5 Sonnet",
  context: `Evaluate both for correctness, code quality, and quality of explanation. The target audience is a mid-level software engineer.`,
};

export type DemoBatchRow = {
  prompt: string;
  response?: string;
  responseA?: string;
  responseB?: string;
  context?: string;
};

export const BATCH_DEMO_RUBRIC_ID = "builtin-overall";

export const BATCH_DEMO_ROWS: DemoBatchRow[] = [
  {
    prompt: "What is the difference between supervised and unsupervised learning?",
    response:
      "Supervised learning uses labeled training data — each example has an input and a known correct output. The model learns to map inputs to outputs (e.g., classifying images as cats or dogs). Unsupervised learning has no labels; the model must find patterns or structure on its own (e.g., clustering customers by behavior). The key distinction: supervised learning needs human-annotated data, which is expensive, while unsupervised learning can work on raw data but the results are harder to evaluate.",
  },
  {
    prompt: "Explain what an API is to a non-technical person.",
    response:
      "An API is like a waiter in a restaurant. You (the app) sit at the table and don't go into the kitchen yourself. Instead, you tell the waiter (the API) what you want, the waiter goes to the kitchen (another service), and brings back your order. The kitchen doesn't need to know who you are, and you don't need to know how the kitchen works — the waiter handles the communication between you. APIs let different software systems talk to each other without knowing each other's internal details.",
  },
  {
    prompt: "What are the pros and cons of using microservices vs. a monolithic architecture?",
    responseA:
      "Microservices: each service is independent, can be deployed and scaled separately, and teams can use different tech stacks. Cons: complex to operate, network latency between services, distributed tracing is hard, and you need mature DevOps. Best for large orgs with many teams. Monolith: simple to develop, test, and deploy initially. Easier to debug. Cons: a single bug can take down everything, scaling requires scaling the whole app, and the codebase becomes unwieldy over time. Best for startups or small teams.",
    responseB:
      "Monoliths are simpler to build first. Microservices give you flexibility but add complexity.",
  },
  {
    prompt: "Explain the CAP theorem in distributed systems.",
    response:
      "CAP theorem states that a distributed system can guarantee at most two of three properties simultaneously: Consistency (every read returns the most recent write), Availability (every request gets a response, even if it might be stale), and Partition Tolerance (the system continues working even if network messages are dropped between nodes). In practice, network partitions happen, so you must choose between CP (consistent but possibly unavailable during a partition — e.g., traditional RDBMS) or AP (always available but possibly returning stale data — e.g., DynamoDB, Cassandra). CAP is a simplification; PACELC extends it to describe the latency/consistency trade-off in the normal (no-partition) case.",
  },
];
